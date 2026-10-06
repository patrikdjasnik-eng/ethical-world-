[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) {
  throw "Installed EXE updates must be built and applied on Windows."
}

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $projectRoot

# Zavřená aplikace dokončí zápisy před nahrazením instalace.
if (Get-Process -Name "EthicalWorld" -ErrorAction SilentlyContinue) {
  throw "Close Ethical World first, then run npm run desktop:update again."
}

# Starší onefile backend může po zavření okna zůstat jako samostatný proces.
$ownedBackendRoots = @(
  (Join-Path $projectRoot "out"),
  (Join-Path $projectRoot "resources\backend"),
  (Join-Path $env:LOCALAPPDATA "ethical_world")
) | ForEach-Object { [IO.Path]::GetFullPath($_).TrimEnd('\') + '\' }
foreach ($backend in @(Get-Process -Name "EthicalWorldBackend" -ErrorAction SilentlyContinue)) {
  $backendPath = $backend.Path
  if ($backendPath -and ($ownedBackendRoots | Where-Object { $backendPath.StartsWith($_, [StringComparison]::OrdinalIgnoreCase) })) {
    Write-Host "Stopping leftover Ethical World backend PID $($backend.Id): $backendPath"
    Stop-Process -InputObject $backend -ErrorAction Stop
  }
}

function Invoke-Checked {
  param([string]$Executable, [string[]]$CommandArguments)
  & $Executable @CommandArguments
  if ($LASTEXITCODE -ne 0) {
    throw "$Executable failed with exit code $LASTEXITCODE. Update stopped."
  }
}

$package = Get-Content -LiteralPath "package.json" -Raw | ConvertFrom-Json
$targetVersion = [string]$package.version
if ($targetVersion -notmatch '^\d+\.\d+\.\d+$') {
  throw "Desktop update requires a stable semantic package version."
}

Write-Host "Building and installing Ethical World $targetVersion" -ForegroundColor Cyan
Invoke-Checked -Executable "npm.cmd" -CommandArguments @("ci")

$updatePython = Join-Path $projectRoot ".venv\Scripts\python.exe"
if (-not (Test-Path -LiteralPath $updatePython)) {
  Invoke-Checked -Executable "python" -CommandArguments @("-m", "venv", ".venv")
}
Invoke-Checked -Executable $updatePython -CommandArguments @("-m", "pip", "install", "-r", "server\requirements.lock.txt")
Invoke-Checked -Executable "npm.cmd" -CommandArguments @("run", "verify")
& $updatePython -m server.test_runner
if ($LASTEXITCODE -ne 0) {
  throw "Backend tests failed. Full tracebacks are saved in out\diagnostics\backend-tests.log. Update stopped before installation."
}
Invoke-Checked -Executable "npm.cmd" -CommandArguments @("run", "desktop:backend:build")

# Každý pokus balí do vlastní složky; starý build může být otevřený či zamčený.
$buildId = [guid]::NewGuid().ToString("N")
$buildOutput = Join-Path $projectRoot "out\updates\$buildId"
$previousBuildDir = $env:ETHICAL_WORLD_BUILD_DIR
$env:ETHICAL_WORLD_BUILD_DIR = $buildOutput
$makeStarted = (Get-Date).ToUniversalTime()
try {
  Invoke-Checked -Executable "npm.cmd" -CommandArguments @("exec", "--", "electron-forge", "make", "--targets", "@electron-forge/maker-squirrel")
} finally {
  if ($null -eq $previousBuildDir) {
    Remove-Item Env:ETHICAL_WORLD_BUILD_DIR -ErrorAction SilentlyContinue
  } else {
    $env:ETHICAL_WORLD_BUILD_DIR = $previousBuildDir
  }
}
$setup = Get-ChildItem -Path (Join-Path $buildOutput "make") -Filter "EthicalWorldSetup.exe" -File -Recurse |
  Sort-Object LastWriteTimeUtc -Descending |
  Select-Object -First 1
if (-not $setup -or $setup.LastWriteTimeUtc -lt $makeStarted.AddSeconds(-2)) {
  throw "No fresh installer was produced. Existing installation was not touched."
}

& (Join-Path $PSScriptRoot "test-desktop-install.ps1") -SkipMake -Launch -ExpectedVersion $targetVersion -RequireBundledBackend -InstallerPath $setup.FullName
Write-Host "Installed Ethical World $targetVersion updated and launched." -ForegroundColor Green
