[CmdletBinding()]
param([string]$BuildDirectory = "out")
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$sourceIcon = Join-Path $projectRoot "assets\icons\EthicalWorld.ico"

function Get-IconFingerprint([string]$File, [switch]$Ico) {
  if ($Ico) { $icon = New-Object Drawing.Icon($File, 32, 32) }
  else { $icon = [Drawing.Icon]::ExtractAssociatedIcon($File) }
  if (-not $icon) { throw "No icon in $File" }
  try {
    $bitmap = $icon.ToBitmap()
    try {
      $resized = New-Object Drawing.Bitmap($bitmap, 32, 32)
      try {
        $pixels = New-Object 'Collections.Generic.List[int]'
        for ($y = 0; $y -lt 32; $y++) {
          for ($x = 0; $x -lt 32; $x++) { $pixels.Add($resized.GetPixel($x, $y).ToArgb()) }
        }
        return ($pixels -join ',')
      } finally { $resized.Dispose() }
    } finally { $bitmap.Dispose() }
  } finally { $icon.Dispose() }
}

$expected = Get-IconFingerprint -File $sourceIcon -Ico
$buildRoot = Join-Path $projectRoot $BuildDirectory
$executables = @(Get-ChildItem -LiteralPath $buildRoot -Recurse -File | Where-Object { $_.Name -in @('EthicalWorld.exe', 'EthicalWorldSetup.exe') })
foreach ($required in @('EthicalWorld.exe', 'EthicalWorldSetup.exe')) {
  if (-not ($executables | Where-Object Name -eq $required)) { throw "Missing packaged $required" }
}
foreach ($executable in $executables) {
  if ((Get-IconFingerprint -File $executable.FullName) -ne $expected) { throw "Placeholder or mismatched icon in $($executable.FullName)" }
  Write-Host "[PASS] Branded icon: $($executable.FullName)"
}
