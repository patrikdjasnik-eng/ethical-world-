[CmdletBinding()]
param(
  [switch]$SkipMake,
  [switch]$Launch,
  [string]$ExpectedVersion = "",
  [string]$InstallerPath = "",
  [switch]$RequireBundledBackend,
  [int]$TimeoutSeconds = 90
)

$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $root

if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) {
  throw "Desktop installer test is supported only on Windows."
}

function Get-EthicalWorldShortcuts {
  param([object]$ShortcutShell, [string[]]$ShortcutLocations)

  if ($null -eq $ShortcutShell) {
    $ShortcutShell = New-Object -ComObject WScript.Shell
  }
  if ($null -eq $ShortcutLocations) {
    $ShortcutLocations = @(
      [Environment]::GetFolderPath("Desktop"),
      [Environment]::GetFolderPath("Programs")
    )
  }
  $locations = $ShortcutLocations | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -Unique

  # -match overwrites the automatic $Matches variable (names are case-insensitive).
  $foundShortcuts = @()

  foreach ($location in $locations) {
    $links = Get-ChildItem -Path $location -Filter "*.lnk" -File -Recurse -ErrorAction SilentlyContinue

    foreach ($link in $links) {
      try {
        $shortcut = $ShortcutShell.CreateShortcut($link.FullName)
        $fingerprint = "$($link.BaseName)|$($shortcut.TargetPath)|$($shortcut.Arguments)"

        if ($fingerprint -match "(?i)Ethical\s*World|EthicalWorld|ethical_world") {
          $foundShortcuts += [PSCustomObject]@{
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

  return $foundShortcuts
}

function Get-EthicalWorldDesktopShortcut {
  param([object[]]$Shortcuts, [string]$DesktopPath, [string]$ExpectedUpdater = "")
  if (-not $DesktopPath) { return $null }
  $desktopPrefix = $DesktopPath.TrimEnd([char[]]@('\', '/')) + [IO.Path]::DirectorySeparatorChar
  return $Shortcuts | Where-Object {
    $_.Path -and $_.Path.StartsWith($desktopPrefix, [StringComparison]::OrdinalIgnoreCase) -and
      (($_.TargetPath -match '(?i)[\\/](EthicalWorld|Update)\.exe$') -or ($_.Arguments -match '(?i)EthicalWorld\.exe')) -and
      (-not $ExpectedUpdater -or $_.TargetPath -eq $ExpectedUpdater)
  } | Select-Object -First 1
}

Write-Host ""
Write-Host "Ethical World desktop installer test" -ForegroundColor Cyan

if (-not $SkipMake) {
  Write-Host "[1/4] Building Windows installer..."
  Write-Host "Running Electron Forge make. If this fails, the maker output above is the primary error."
  npm run desktop:make

  if ($LASTEXITCODE -ne 0) {
    $exitCode = $LASTEXITCODE
    Write-Host ""
    Write-Host "[FAIL] Electron Forge desktop:make failed." -ForegroundColor Red
    Write-Host "Run these separately to isolate the failing maker:" -ForegroundColor Yellow
    Write-Host "  npm run desktop:make:squirrel"
    Write-Host "  npm run desktop:make:zip"
    throw "desktop:make failed with exit code $exitCode."
  }
} else {
  Write-Host "[1/4] Build skipped."
}

if ($InstallerPath) {
  $setup = Get-Item -LiteralPath $InstallerPath
  if ($setup.PSIsContainer -or $setup.Name -ne "EthicalWorldSetup.exe") {
    throw "InstallerPath must point to EthicalWorldSetup.exe."
  }
} else {
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

}

$before = @(Get-EthicalWorldShortcuts)
$beforeMap = @{}

foreach ($item in $before) {
  $beforeMap[$item.Path] = $item.LastWriteTimeUtc
}

Write-Host "[2/4] Running installer: $($setup.FullName)"
$installStarted = (Get-Date).ToUniversalTime()
$installerProcess = Start-Process -FilePath $setup.FullName -Wait -PassThru
if ($installerProcess.ExitCode -ne 0) {
  throw "Installer failed with exit code $($installerProcess.ExitCode)."
}

if ($ExpectedVersion) {
  $installRoot = Join-Path $env:LOCALAPPDATA "ethical_world"
  $installedApp = Join-Path $installRoot "app-$ExpectedVersion"
  $installedExe = Join-Path $installedApp "EthicalWorld.exe"
  if (-not (Test-Path -LiteralPath $installedExe -PathType Leaf)) {
    throw "Expected installed version $ExpectedVersion was not found at $installedExe."
  }
  $productVersion = (Get-Item -LiteralPath $installedExe).VersionInfo.ProductVersion
  if ($productVersion -notmatch ("^" + [regex]::Escape($ExpectedVersion) + "(?:$|[.+-])")) {
    throw "Installed EXE reports version $productVersion instead of $ExpectedVersion."
  }
  if ($RequireBundledBackend -and -not (Test-Path -LiteralPath (Join-Path $installedApp "resources\backend\EthicalWorldBackend.exe") -PathType Leaf)) {
    throw "Updated EXE has no bundled backend."
  }
  Write-Host "[PASS] Installed EXE version: $productVersion" -ForegroundColor Green

  $updateExe = Join-Path $installRoot "Update.exe"
  if (-not (Test-Path -LiteralPath $updateExe -PathType Leaf)) {
    throw "Installed Squirrel updater was not found at $updateExe."
  }
  $desktopDirectory = [Environment]::GetFolderPath("Desktop")
  if (-not $desktopDirectory) { throw "Current user has no Desktop directory." }
  $canonicalShortcut = Join-Path $desktopDirectory "Ethical World.lnk"
  $shortcutPaths = @($canonicalShortcut)
  foreach ($item in $before) {
    if ($item.TargetPath -match '(?i)[\\/](EthicalWorld|Update)\.exe$') {
      $shortcutPaths += $item.Path
    }
  }
  $shortcutShell = New-Object -ComObject WScript.Shell
  foreach ($shortcutPath in ($shortcutPaths | Select-Object -Unique)) {
    $shortcut = $shortcutShell.CreateShortcut($shortcutPath)
    $shortcut.TargetPath = $updateExe
    $shortcut.Arguments = '--processStart "EthicalWorld.exe"'
    $shortcut.WorkingDirectory = $installRoot
    $shortcut.Description = "Ethical World"
    $shortcut.IconLocation = "$installedExe,0"
    $shortcut.Save()
  }
  Write-Host "[PASS] Desktop shortcuts now use installed Update.exe." -ForegroundColor Green
}

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
$expectedUpdater = ""
if ($ExpectedVersion) { $expectedUpdater = $updateExe }
$desktopShortcut = Get-EthicalWorldDesktopShortcut -Shortcuts $shortcuts -DesktopPath $desktopPath -ExpectedUpdater $expectedUpdater

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

  if ($ExpectedVersion -and $process.Path -ne $installedExe) {
    throw "A different EXE started: $($process.Path). Expected $installedExe."
  }
  Write-Host "[PASS] EthicalWorld.exe started from the Desktop shortcut (PID $($process.Id))." -ForegroundColor Green
} else {
  Write-Host "[4/4] Launch test skipped. Use npm run desktop:test-install:launch for the full launch test."
}

Write-Host ""
Write-Host "Desktop shortcut test completed successfully." -ForegroundColor Green
