# Desktop / EXE

![Desktop](https://img.shields.io/badge/desktop-Electron-47848F)
![Windows](https://img.shields.io/badge/target-Windows-0078D4)
![Packaging](https://img.shields.io/badge/package-Electron_Forge-111827)
![Security](https://img.shields.io/badge/contextIsolation-on-16a34a)

Ethical World má od této verze samostatný desktop shell. React/Vite renderer zůstává společný pro web i desktop, ale Electron přidává nativní okno, preload bridge, native context menu a základ pro skutečný filesystem vault.

## Vývoj

```powershell
npm install
npm run desktop:dev
```

Tento příkaz spustí Vite a po jeho naběhnutí otevře Ethical World jako desktop aplikaci.

Web varianta dál funguje samostatně:

```powershell
npm run dev
```

## Lokální ověření

GitHub Actions nejsou potřeba pro běžný vývoj:

```powershell
npm run verify
```

To spustí testy a produkční frontend build.

## Vytvoření Windows balíčku

```powershell
npm run desktop:make
```

Electron Forge vytvoří lokální distributable pod `out/`. Windows build se tedy dá vyrábět přímo na vývojovém PC bez cloud CI.

Pro rychlý neinstalační package:

```powershell
npm run desktop:package
```

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

Aktuální preload API je úmyslně malé:

- `showContextMenu()`;
- `selectVaultFolder()`;
- platform information.

Filesystem read/write API bude přidáno jako samostatná vault service s kontrolou root path, ne jako obecný přístup k Node `fs`.

## Native graph interaction

V Electron režimu graph používá native context menu pro pravý klik. Browser fallback dál používá vlastní HTML context menu, takže stejný frontend lze testovat i přes Vite.

## Další desktop krok

1. filesystem Markdown vault;
2. watcher externích změn;
3. import existujícího Obsidian vaultu;
4. native drag/drop attachments;
5. lokální AI gateway startovaná aplikací;
6. custom titlebar a tray;
7. podepisování release buildu.
