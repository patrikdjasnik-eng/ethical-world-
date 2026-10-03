[CmdletBinding()]
param(
  [switch]$SkipMake,
  [switch]$Launch,
  [int]$TimeoutSeconds = 90
)

$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $root

if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) {
  throw "Desktop installer test is supported only on Windows."
}

function Get-EthicalWorldShortcuts {
  $shell = New-Object -ComObject WScript.Shell
  $locations = @(
    [Environment]::GetFolderPath("Desktop"),
    [Environment]::GetFolderPath("Programs")
  ) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -Unique

  $matches = @()

  foreach ($location in $locations) {
    $links = Get-ChildItem -Path $location -Filter "*.lnk" -File -Recurse -ErrorAction SilentlyContinue

    foreach ($link in $links) {
      try {
        $shortcut = $shell.CreateShortcut($link.FullName)
        $fingerprint = "$($link.BaseName)|$($shortcut.TargetPath)|$($shortcut.Arguments)"

        if ($fingerprint -match "(?i)Ethical\s*World|EthicalWorld|ethical_world") {
          $matches += [PSCustomObject]@{
            Path = $link.FullName
            TargetPath = $shortcut.TargetPath
            Arguments = $shortcut.Arguments
            IconLocation = $shortcut.IconLocation
            LastWriteTimeUtc = $link.LastWriteTimeUtc
          }
        }
      } catch {
        Write-Verbose "Unable to inspect shortcut $($link.FullName): $($_.Exception.Message)"
      }
    }
  }

  return $matches
}

Write-Host ""
Write-Host "Ethical World desktop installer test" -ForegroundColor Cyan
Write-Host "------------------------------------"

if (-not $SkipMake) {
  Write-Host "[1/4] Building Windows installer..."
  npm run desktop:make

  if ($LASTEXITCODE -ne 0) {
    throw "desktop:make failed with exit code $LASTEXITCODE."
  }
} else {
  Write-Host "[1/4] Build skipped."
}

$setup = Get-ChildItem -Path (Join-Path $root "out") -Filter "EthicalWorldSetup.exe" -File -Recurse -ErrorAction SilentlyContinue |
  Sort-Object LastWriteTimeUtc -Descending |
  Select-Object -First 1

if (-not $setup) {
  $setup = Get-ChildItem -Path (Join-Path $root "out") -Filter "*Setup.exe" -File -Recurse -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTimeUtc -Descending |
    Select-Object -First 1
}

if (-not $setup) {
  throw "No Squirrel Setup.exe was found under $root\out."
}

$before = @(Get-EthicalWorldShortcuts)
$beforeMap = @{}

foreach ($item in $before) {
  $beforeMap[$item.Path] = $item.LastWriteTimeUtc
}

Write-Host "[2/4] Running installer: $($setup.FullName)"
$installStarted = (Get-Date).ToUniversalTime()
Start-Process -FilePath $setup.FullName -Wait

Write-Host "[3/4] Waiting for Desktop/Start Menu shortcut..."

$deadline = (Get-Date).AddSeconds($TimeoutSeconds)
$shortcuts = @()

do {
  Start-Sleep -Milliseconds 750
  $shortcuts = @(Get-EthicalWorldShortcuts)

  if ($shortcuts.Count -gt 0) {
    break
  }
} while ((Get-Date) -lt $deadline)

if ($shortcuts.Count -eq 0) {
  throw "Installer finished, but no Ethical World shortcut was found within $TimeoutSeconds seconds."
}

$desktopPath = [Environment]::GetFolderPath("Desktop")
$desktopShortcut = $shortcuts |
  Where-Object { $_.Path.StartsWith($desktopPath, [System.StringComparison]::OrdinalIgnoreCase) } |
  Select-Object -First 1

if (-not $desktopShortcut) {
  throw "Ethical World shortcut exists, but no shortcut was found on the current user's Desktop: $desktopPath"
}

$freshShortcut = $false

if (-not $beforeMap.ContainsKey($desktopShortcut.Path)) {
  $freshShortcut = $true
} elseif ($desktopShortcut.LastWriteTimeUtc -gt $beforeMap[$desktopShortcut.Path]) {
  $freshShortcut = $true
} elseif ($desktopShortcut.LastWriteTimeUtc -ge $installStarted.AddSeconds(-5)) {
  $freshShortcut = $true
}

Write-Host "[PASS] Desktop shortcut: $($desktopShortcut.Path)" -ForegroundColor Green
Write-Host "       Target: $($desktopShortcut.TargetPath)"
Write-Host "       Args:   $($desktopShortcut.Arguments)"

if ($desktopShortcut.IconLocation) {
  Write-Host "       Icon:   $($desktopShortcut.IconLocation)"
} else {
  Write-Host "       Icon:   inherited from shortcut target"
}

if ($freshShortcut) {
  Write-Host "[PASS] Shortcut was created or refreshed by this install." -ForegroundColor Green
} else {
  Write-Warning "Shortcut already existed and its timestamp did not change. The shortcut target is valid, but use a clean install to prove first-install creation."
}

$targetLooksValid =
  ($desktopShortcut.TargetPath -match "(?i)Update\.exe$|EthicalWorld\.exe$") -or
  ($desktopShortcut.Arguments -match "(?i)EthicalWorld\.exe")

if (-not $targetLooksValid) {
  throw "Shortcut exists, but its target/arguments do not look like an Ethical World Squirrel shortcut."
}

Write-Host "[PASS] Shortcut target looks valid." -ForegroundColor Green

if ($Launch) {
  Write-Host "[4/4] Launching Ethical World through the Desktop shortcut..."
  Start-Process -FilePath $desktopShortcut.Path

  $launchDeadline = (Get-Date).AddSeconds(20)
  $process = $null

  do {
    Start-Sleep -Milliseconds 500
    $process = Get-Process -Name "EthicalWorld" -ErrorAction SilentlyContinue | Select-Object -First 1
  } while (-not $process -and (Get-Date) -lt $launchDeadline)

  if (-not $process) {
    throw "Desktop shortcut was created, but EthicalWorld.exe did not start within 20 seconds."
  }

  Write-Host "[PASS] EthicalWorld.exe started from the Desktop shortcut (PID $($process.Id))." -ForegroundColor Green
} else {
  Write-Host "[4/4] Launch test skipped. Use npm run desktop:test-install:launch for the full launch test."
}

Write-Host ""
Write-Host "Desktop shortcut test completed successfully." -ForegroundColor Green
