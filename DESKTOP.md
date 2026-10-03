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
