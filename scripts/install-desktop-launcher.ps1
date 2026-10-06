[CmdletBinding()]
param([string]$launcherDirectory = "")

$ErrorActionPreference = "Stop"
if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) { throw "Launcher installation requires Windows." }
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$nodePath = (Get-Command node.exe -ErrorAction Stop).Source
$powershellPath = Join-Path $env:SystemRoot "System32\WindowsPowerShell\v1.0\powershell.exe"
if (-not $launcherDirectory) { $launcherDirectory = Join-Path $env:LOCALAPPDATA "EthicalWorldLauncher" }
$launcherDirectory = [IO.Path]::GetFullPath($launcherDirectory)

& git -C $projectRoot rev-parse --show-toplevel | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Launcher requires a Git clone." }
$branchName = & git -C $projectRoot branch --show-current
if ($LASTEXITCODE -ne 0 -or $branchName -ne "dev/first-runnable") { throw "Checkout dev/first-runnable before installing the launcher." }
$originUrl = & git -C $projectRoot remote get-url origin
if ($LASTEXITCODE -ne 0) { throw "Git origin is missing." }
# The same validation is used by the worker on every run; no token is saved in config.
& $nodePath -e 'require(process.argv[1]).remoteIdentity(process.argv[2])' (Join-Path $PSScriptRoot "launcher-core.cjs") $originUrl
if ($LASTEXITCODE -ne 0) { throw "Unexpected Git origin. Launcher was not installed." }

New-Item -ItemType Directory -Path $launcherDirectory -Force | Out-Null
foreach ($launcherFile in @("desktop-launcher.ps1", "launcher-core.cjs")) {
  Copy-Item -LiteralPath (Join-Path $PSScriptRoot $launcherFile) -Destination (Join-Path $launcherDirectory $launcherFile) -Force
}
$launcherConfig = [ordered]@{
  schemaVersion = 1
  repoPath = $projectRoot
  branch = "dev/first-runnable"
  nodePath = $nodePath
  powershellPath = $powershellPath
  installRoot = (Join-Path $env:LOCALAPPDATA "ethical_world")
}
[IO.File]::WriteAllText((Join-Path $launcherDirectory "config.json"), ($launcherConfig | ConvertTo-Json), (New-Object Text.UTF8Encoding($false)))

$shortcutShell = New-Object -ComObject WScript.Shell
$installedIcon = Get-ChildItem -LiteralPath $launcherConfig.installRoot -Filter "EthicalWorld.exe" -File -Recurse -ErrorAction SilentlyContinue |
  Sort-Object LastWriteTimeUtc -Descending | Select-Object -First 1
$launcherIconPath = Join-Path $launcherDirectory "EthicalWorld.ico"
if ($installedIcon) {
  try {
    Add-Type -AssemblyName System.Drawing
    $applicationIcon = [Drawing.Icon]::ExtractAssociatedIcon($installedIcon.FullName)
    $iconStream = [IO.File]::Create("$launcherIconPath.tmp")
    try { $applicationIcon.Save($iconStream) } finally { $iconStream.Dispose(); $applicationIcon.Dispose() }
    Move-Item -LiteralPath "$launcherIconPath.tmp" -Destination $launcherIconPath -Force
  } catch {
    Write-Warning "The launcher icon could not be refreshed; its existing/default icon will be used."
  }
}
$shortcutDirectories = @([Environment]::GetFolderPath("Desktop"), [Environment]::GetFolderPath("Programs")) | Select-Object -Unique
foreach ($shortcutDirectory in $shortcutDirectories) {
  if (-not $shortcutDirectory) { continue }
  $launcherShortcut = $shortcutShell.CreateShortcut((Join-Path $shortcutDirectory "Ethical World Launcher.lnk"))
  $launcherShortcut.TargetPath = $powershellPath
  $launcherShortcut.Arguments = '-NoProfile -STA -WindowStyle Hidden -ExecutionPolicy Bypass -File "' + (Join-Path $launcherDirectory "desktop-launcher.ps1") + '"'
  $launcherShortcut.WorkingDirectory = $launcherDirectory
  $launcherShortcut.Description = "Ethical World - automatic Git update and launch"
  if (Test-Path -LiteralPath $launcherIconPath) { $launcherShortcut.IconLocation = "$launcherIconPath,0" }
  $launcherShortcut.Save()
}
Write-Host "[OK] Ethical World Launcher installed on Desktop and Start Menu." -ForegroundColor Green
Write-Host "Open Ethical World Launcher to check Git, update and launch automatically."
