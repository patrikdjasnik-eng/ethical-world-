[CmdletBinding()]
param([string]$BuildDirectory = "out")
$ErrorActionPreference = "Stop"
& node (Join-Path $PSScriptRoot "test-desktop-icons.cjs") $BuildDirectory
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
