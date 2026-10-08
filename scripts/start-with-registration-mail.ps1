[CmdletBinding()]
param([switch]$Dev)

$ErrorActionPreference = "Stop"
if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) { throw "This script requires Windows." }
if (Get-Process -Name "EthicalWorld" -ErrorAction SilentlyContinue) { throw "Nejdrive zavri Ethical World, aby novy backend prevzal nastaveni posty." }
$installedLauncher = Join-Path $env:LOCALAPPDATA "EthicalWorldLauncher\desktop-launcher.ps1"
if (-not $Dev -and -not (Test-Path -LiteralPath $installedLauncher)) { throw "Launcher neni nainstalovany. Pro vyvoj pouzij parametr -Dev." }
$mailCredential = Get-Credential -UserName "rabbithollowczech@gmail.com" -Message "Zadej heslo aplikace Gmail pro Ethical World (ne bezne heslo uctu)."
if (-not $mailCredential) { return }
$mailConfig = @{
  ETHICAL_WORLD_SMTP_HOST = "smtp.gmail.com"
  ETHICAL_WORLD_SMTP_PORT = "465"
  ETHICAL_WORLD_SMTP_USER = $mailCredential.UserName
  ETHICAL_WORLD_SMTP_PASSWORD = $mailCredential.GetNetworkCredential().Password
}
$previousMailConfig = @{}
try {
  foreach ($settingName in $mailConfig.Keys) {
    $previousMailConfig[$settingName] = [Environment]::GetEnvironmentVariable($settingName, "Process")
    [Environment]::SetEnvironmentVariable($settingName, $mailConfig[$settingName], "Process")
  }
  if ($Dev) {
    Push-Location (Join-Path $PSScriptRoot "..")
    try { & npm.cmd run desktop:dev } finally { Pop-Location }
    if ($LASTEXITCODE -ne 0) { throw "Desktop development failed." }
  } else {
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $installedLauncher
    if ($LASTEXITCODE -ne 0) { throw "Launcher failed." }
  }
} finally {
  foreach ($settingName in $previousMailConfig.Keys) {
    [Environment]::SetEnvironmentVariable($settingName, $previousMailConfig[$settingName], "Process")
  }
  $mailConfig.Clear()
  $mailCredential = $null
}
