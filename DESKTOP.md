# Desktop / EXE

![Desktop](https://img.shields.io/badge/desktop-Electron-47848F)
![Windows](https://img.shields.io/badge/target-Windows-0078D4)
![Packaging](https://img.shields.io/badge/package-Electron_Forge-111827)
![Updates](https://img.shields.io/badge/updates-GitHub_Releases-7c3aed)
![Security](https://img.shields.io/badge/contextIsolation-on-16a34a)

Ethical World má desktop shell přes Electron. React/Vite renderer zůstává společný pro web i desktop, Electron přidává nativní okno, preload bridge, native context menu, packaging a auto-update.

## Vývoj

```powershell
npm install
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

Nainstalované Windows EXE se aktualizuje přes GitHub Releases.

Flow:

```text
nový kód v repu
   ↓
zvýšení package version
   ↓
lokální build + publish
   ↓
GitHub Release
   ↓
update.electronjs.org
   ↓
Ethical World EXE
   ↓
download na pozadí
   ↓
restart / install update
```

Updater běží pouze v packaged buildu. Dev režim `npm run desktop:dev` update nekontroluje.

Aplikace používá `update-electron-app` a veřejný Electron update service pro repozitář:

```text
patrikdjasnik-eng/ethical-world-
```

Update check proběhne při startu a poté pravidelně.

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
