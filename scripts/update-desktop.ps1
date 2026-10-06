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
Invoke-Checked -Executable $updatePython -CommandArguments @("-m", "unittest", "discover", "-s", "server/tests", "-v")
Invoke-Checked -Executable "npm.cmd" -CommandArguments @("run", "desktop:backend:build")

# Zabraňuje použití starého instalátoru, pokud make nevytvoří nový výstup.
$makeStarted = (Get-Date).ToUniversalTime()
Invoke-Checked -Executable "npm.cmd" -CommandArguments @("exec", "--", "electron-forge", "make", "--targets", "@electron-forge/maker-squirrel")
$setup = Get-ChildItem -Path (Join-Path $projectRoot "out\make") -Filter "EthicalWorldSetup.exe" -File -Recurse |
  Sort-Object LastWriteTimeUtc -Descending |
  Select-Object -First 1
if (-not $setup -or $setup.LastWriteTimeUtc -lt $makeStarted.AddSeconds(-2)) {
  throw "No fresh installer was produced. Existing installation was not touched."
}

& (Join-Path $PSScriptRoot "test-desktop-install.ps1") -SkipMake -Launch -ExpectedVersion $targetVersion -RequireBundledBackend
Write-Host "Installed Ethical World $targetVersion updated and launched." -ForegroundColor Green
