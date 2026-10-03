# Architecture

![Architecture](https://img.shields.io/badge/docs-architecture-2563eb)
![Status](https://img.shields.io/badge/status-active-16a34a)
![Version](https://img.shields.io/badge/version-0.1.0-6f42c1)
![Desktop](https://img.shields.io/badge/desktop-Electron-47848F)

## Cíl

Ethical World je local-first knowledge workspace s odděleným rendererem, vault službami, desktop bridge a AI vrstvou.

```text
                    Ethical World
                         │
                 React + TypeScript
                         │
       ┌─────────────────┼─────────────────┐
       │                 │                 │
   Vault UI          Knowledge Graph     Máša UI
       │                                   │
       └──────────────┬────────────────────┘
                      │
              Domain / vault services
                      │
        ┌─────────────┴─────────────┐
        │                           │
 Browser storage               Electron bridge
   IndexedDB                 contextBridge + IPC
                                    │
                              Desktop main process
                                    │
                         native filesystem / menus

AI client
  ↓
FastAPI gateway
  ↓
Provider router
  ├─ Ollama
  └─ OpenAI-compatible
```

## Renderer

React + TypeScript renderer je společný pro web i desktop. Nemá přímý přístup k Node.js ani k Electron internals.

Aktuální funkce:

- nested vault explorer;
- Markdown editor;
- one-click Markdown inserts;
- wiki links a backlinks;
- fulltext search;
- interaktivní knowledge graph;
- Máša chat panel.

## Browser storage

Web fallback používá IndexedDB. Díky tomu může aplikace dál fungovat přes Vite bez Electronu.

## Desktop shell

Electron main process otevírá stejný Vite renderer. Privilegované operace jsou dostupné pouze přes úzké metody v `preload.cjs`.

Security konfigurace:

- `contextIsolation: true`;
- `nodeIntegration: false`;
- `sandbox: true`;
- žádné obecné `ipcRenderer.send` vystavené rendereru.

První desktop bridge podporuje native context menu a výběr vault adresáře.

## Filesystem vault

Další storage adapter bude používat skutečné `.md` soubory jako source of truth.

```text
vault/
├─ Projects/
├─ Knowledge/
├─ Cybersecurity/
├─ Assets/
└─ .ethical/
   ├─ index.db
   └─ settings.json
```

Renderer nebude dostávat raw filesystem. Main process bude kontrolovat, že každá cesta zůstává uvnitř vybraného vault rootu.

## Wiki graph

`[[Název poznámky]]` je společný kontrakt editoru, graphu i budoucích Máša tools. Graph v2 podporuje focus, auto-fit, local graph, search, hidden nodes, native/browser context menu a degree-based rendering.

## AI gateway

FastAPI backend zatím drží provider-specific komunikaci mimo renderer. Další desktop iterace může gateway buď spouštět jako lokální child process, nebo její provider router přesunout do Electron main procesu.

## Agent tools

Máša bude používat stejné doménové operace jako UI:

`searchNotes`, `readNote`, `createNote`, `updateNote`, `linkNotes`, `moveNote`, `createFolder`, `createTask` a další.

Zápisové operace budou používat permission gate a proposal/diff flow.
