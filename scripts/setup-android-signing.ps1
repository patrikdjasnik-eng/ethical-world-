[CmdletBinding()]
param(
    [string]$Repository = "patrikdjasnik-eng/ethical-world-",
    [string]$KeystorePath = (Join-Path $HOME ".ethical-world\android-release.jks")
)

$ErrorActionPreference = "Stop"

function Assert-Command([string]$Name) {
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Chybí příkaz '$Name'. Nainstaluj Java JDK 21 (keytool) a GitHub CLI (gh), potom se znovu přihlas přes gh auth login."
    }
}

Assert-Command "keytool"
Assert-Command "gh"
& gh auth status
if ($LASTEXITCODE -ne 0) { throw "GitHub CLI není přihlášené." }

$parent = Split-Path -Parent $KeystorePath
New-Item -ItemType Directory -Path $parent -Force | Out-Null
if (Test-Path $KeystorePath) {
    throw "Keystore už existuje: $KeystorePath. Z bezpečnostních důvodů ho nepřepisuji."
}

$random = New-Object byte[] 36
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($random)
$rng.Dispose()
$password = [Convert]::ToBase64String($random).Replace("+", "A").Replace("/", "B").Replace("=", "C")
$alias = "ethical-world-release"

Write-Host "Vytvářím dlouhodobý Android release signing key..." -ForegroundColor Cyan
$keyArgs = @(
    "-genkeypair", "-v",
    "-keystore", $KeystorePath,
    "-storetype", "JKS",
    "-keyalg", "RSA",
    "-keysize", "4096",
    "-validity", "10000",
    "-alias", $alias,
    "-storepass", $password,
    "-keypass", $password,
    "-dname", "CN=Ethical World, OU=Mobile, O=RabbitHollow, L=Prague, ST=Prague, C=CZ",
    "-noprompt"
)
& keytool @keyArgs
if ($LASTEXITCODE -ne 0) { throw "Vytvoření keystore selhalo." }

$base64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($KeystorePath))
Write-Host "Nastavuji čtyři GitHub Actions secrets pro $Repository..." -ForegroundColor Cyan
& gh secret set ANDROID_KEYSTORE_BASE64 --repo $Repository --body $base64
if ($LASTEXITCODE -ne 0) { throw "Nastavení ANDROID_KEYSTORE_BASE64 selhalo." }
& gh secret set ANDROID_KEYSTORE_PASSWORD --repo $Repository --body $password
if ($LASTEXITCODE -ne 0) { throw "Nastavení ANDROID_KEYSTORE_PASSWORD selhalo." }
& gh secret set ANDROID_KEY_ALIAS --repo $Repository --body $alias
if ($LASTEXITCODE -ne 0) { throw "Nastavení ANDROID_KEY_ALIAS selhalo." }
& gh secret set ANDROID_KEY_PASSWORD --repo $Repository --body $password
if ($LASTEXITCODE -ne 0) { throw "Nastavení ANDROID_KEY_PASSWORD selhalo." }

Write-Host ""
Write-Host "Hotovo. Android signing secrets jsou nastavené." -ForegroundColor Green
Write-Host "Soukromý keystore: $KeystorePath" -ForegroundColor Yellow
Write-Host "Udělej jeho šifrovanou zálohu mimo PC. Nikdy ho necommituj do Git." -ForegroundColor Yellow
Write-Host "Pozor: tato release signatura se liší od dosavadní CI debug APK. Před přechodem exportuj poznámky a ověř zálohu." -ForegroundColor Yellow
