$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$python = Join-Path $root ".venv\Scripts\python.exe"
if (-not (Test-Path $python)) { throw "Missing .venv Python at $python" }

& $python -m pip install -r server\requirements.lock.txt -r server\requirements-build.txt
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$outDir = Join-Path $root "resources\backend"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$buildArguments = @(
  "-m", "PyInstaller",
  "--noconfirm",
  "--clean",
  "--onefile",
  "--name", "EthicalWorldBackend",
  "--distpath", $outDir,
  "--workpath", (Join-Path $root "out\backend-build"),
  "--specpath", (Join-Path $root "out\backend-spec"),
  "--collect-all", "cryptography",
  "--collect-all", "uvicorn",
  "--collect-all", "fastapi",
  "server\desktop_entry.py"
)
& $python @buildArguments
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "[OK] Bundled backend: $outDir\EthicalWorldBackend.exe"
