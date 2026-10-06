# Desktop / EXE

![Desktop](https://img.shields.io/badge/desktop-Electron-47848F)
![Windows](https://img.shields.io/badge/target-Windows-0078D4)
![Packaging](https://img.shields.io/badge/package-Electron_Forge-111827)
![Updates](https://img.shields.io/badge/updates-GitHub_Releases-7c3aed)
![Security](https://img.shields.io/badge/contextIsolation-on-16a34a)

Ethical World má desktop shell přes Electron. React/Vite renderer zůstává společný pro web i desktop, Electron přidává nativní okno, preload bridge, native context menu, packaging a auto-update.

## Vývoj

```powershell
npm ci
npm run desktop:dev
```

Web varianta dál funguje:

```powershell
npm run dev
```

## Lokální ověření

```powershell
npm run verify
```

## Windows build

```powershell
npm run desktop:make
```

Výstup je pod `out/`.

## Auto-update

Repozitář je private. Veřejný Electron update service neumí autentizovat private Releases, proto je automatická kontrola aktualizací standardně vypnutá. Nový instalační balíček distribuujeme ručně přes přístup k private repozitáři. GitHub token nikdy nevkládáme do rendereru nebo instalátoru.

Pouze při vědomém přechodu na veřejné Releases lze zapnout `ETHICAL_WORLD_PUBLIC_UPDATES=1`. Nastavení CI/CD nebo placeného plánu není podmínkou lokálního ověření a sestavení.

Desktop na portu 8787 spouští vlastní backend s náhodnou runtime capability a ověřuje challenge proof. Obsazený port nepřebírá. Renderer používá validované IPC místo `file://` fetch/CORS. Notion OAuth callback používá výchozí port 8787; změna `ETHICAL_WORLD_DESKTOP_PORT` vyžaduje odpovídající OAuth redirect konfiguraci.

### Vydání nové patch verze

Nejdřív musí být working tree čistý.

```powershell
npm run version:patch
git push origin dev/first-runnable
git push --tags
```

Pak nastav GitHub token pouze do aktuálního PowerShell procesu:

```powershell
$env:GITHUB_TOKEN="TVUJ_GITHUB_TOKEN"
npm run desktop:publish
Remove-Item Env:GITHUB_TOKEN
```

`desktop:publish` spustí lokální testy + build, vytvoří Windows artefakty a přes Electron Forge GitHub Publisher je nahraje jako GitHub Release.

Token se nesmí commitnout do repozitáře ani zapisovat do aplikace.

Pro větší release lze místo patch použít:

```powershell
npm run version:minor
npm run version:major
```

### Důležité

Samotný `git pull` nainstalované EXE neaktualizuje. Desktop updater stahuje pouze hotové GitHub Releases s vyšší SemVer verzí. To brání tomu, aby si produkční aplikace stahovala neověřený zdrojový stav větve a pokoušela se sama přebuildovat.

Release nesmí být draft ani prerelease, pokud má být distribuován běžným stable updaterem.

## Security model

Renderer nedostává Node.js API.

```text
React renderer
  ↓
window.ethicalDesktop
  ↓
contextBridge
  ↓
preload.cjs
  ↓
Electron IPC
  ↓
main.cjs
```

`contextIsolation` je zapnuté, `nodeIntegration` vypnuté a renderer běží v sandboxu.

Squirrel.Windows startup events zpracovává `electron-squirrel-startup`, aby install/update lifecycle nespouštěl aplikaci nekorektně vícekrát.

## Native graph interaction

V Electron režimu graph používá native context menu pro pravý klik. Browser fallback používá HTML context menu.

## Další desktop krok

1. filesystem Markdown vault;
2. watcher externích změn;
3. import existujícího Obsidian vaultu;
4. native drag/drop attachments;
5. lokální AI gateway startovaná aplikací;
6. custom titlebar a tray;
7. release signing.


## Desktop shortcut

Squirrel.Windows při instalaci a update lifecycle vytváří zástupce aplikace v Start Menu a na ploše aktuálního Windows uživatele. Ethical World používá `electron-squirrel-startup` pro obsluhu těchto událostí.

Windows AppUserModelID:

```text
com.squirrel.ethical_world.EthicalWorld
```

To drží identitu shortcutu, taskbaru a Squirrel package konzistentní.

Installer má deterministický název:

```text
EthicalWorldSetup.exe
```

### Automatický instalační test

Plný test od buildu až po shortcut:

```powershell
npm run desktop:test-install
```

Test:

1. spustí `npm run desktop:make`;
2. najde `EthicalWorldSetup.exe`;
3. skutečně spustí Squirrel installer;
4. čeká na vytvoření shortcutu;
5. ověří Desktop `.lnk`;
6. přes Windows `WScript.Shell` přečte jeho target a arguments;
7. ověří, že shortcut míří na Squirrel `Update.exe` / `EthicalWorld.exe`.

Pro úplný smoke test včetně spuštění aplikace přes novou ikonu:

```powershell
npm run desktop:test-install:launch
```

Pokud už je Ethical World na PC nainstalovaný, test umí shortcut stále ověřit. Pro definitivní důkaz chování při úplně první instalaci je nejlepší test spustit na čistém Windows účtu, Windows Sandboxu nebo VM.

Pokud už installer existuje a nechceš znovu buildovat:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-desktop-install.ps1 -SkipMake -Launch
```

> Shortcut zatím používá ikonu zabudovanou v executable. Vlastní brandované `.ico` přidáme do packageru samostatně, jakmile uzamkneme finální Ethical World logo.

## Aktualizace již nainstalovaného EXE z private repozitáře

Po `git pull --ff-only origin dev/first-runnable` zavři Ethical World a spusť `npm run desktop:update` v kořeni repozitáře na Windows. Skript obnoví uzamčené závislosti, spustí lokální kontroly, nově sestaví bundled Python backend a Squirrel installer a provede upgrade stejné aplikace. Potom ověří ProductVersion nainstalovaného EXE, přítomnost backendu a spuštění přes existující desktop shortcut. Uživatelský datový adresář nemaže.

Verze balíčku je nyní 0.1.1, aby instalátor rozlišil novou sestavu od původní 0.1.0. Nejde o automatické stažení z GitHub Releases: instalátor se sestavuje na vlastním Windows stroji a nevyžaduje veřejný repozitář, GitHub token uvnitř aplikace ani Actions. Skript vyžaduje již dostupné Node/npm a Python; při chybě před instalací skončí bez změny nainstalovaného EXE. Git konflikty řešíme před buildem; update skript nepoužívá reset/clean ani nemění Git větve.

Pokud backend test gate selže, úplný výpis je v `out/diagnostics/backend-tests.log`. Samostatná diagnostika: `.\.venv\Scripts\python.exe -m server.test_runner`. Hlásit první `ERROR` a navazující traceback, nikoli pouze poslední PowerShell `Update stopped`. Instalátor se při této chybě ještě nespustil.

Při EBUSY v předchozím packaging výstupu updater nově balí do unikátního `out/updates/<guid>`. Instalátor používá přesnou cestu aktuálního buildu a po instalaci obnoví desktop shortcut přes nainstalované `Update.exe`, nikoli EXE ve složce out. Staré buildy můžeš uklidit až po ověření nové instalace; aktualizační skript je nemaže. Zbylé backend procesy se ukončují pouze podle konkrétního názvu a ověřené cesty tohoto projektu/instalace.
