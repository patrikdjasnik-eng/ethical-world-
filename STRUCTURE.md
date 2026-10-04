# Repository Structure

![Docs](https://img.shields.io/badge/docs-structure-0ea5e9)
![Status](https://img.shields.io/badge/status-current-16a34a)

```text
ethical-world-/
├─ electron/
│  ├─ main.cjs
│  └─ preload.cjs
├─ public/
│  ├─ ethical-world-mark.svg
│  └─ sw.js
├─ scripts/
│  ├─ build-backend.ps1
│  └─ test-desktop-install.ps1
├─ server/
│  ├─ __init__.py
│  ├─ auth_store.py
│  ├─ desktop_entry.py
│  ├─ main.py
│  ├─ notion_connector.py
│  ├─ providers.py
│  ├─ requirements.txt
│  └─ requirements-build.txt
├─ src/
│  ├─ components/
│  │  ├─ AccountPanel.tsx
│  │  ├─ ActivityRail.tsx
│  │  ├─ AiPanel.tsx
│  │  ├─ ConnectorPanel.tsx
│  │  ├─ EditorPane.tsx
│  │  ├─ GraphPane.tsx
│  │  ├─ GuidePanel.tsx
│  │  ├─ InsertMenu.tsx
│  │  ├─ MermaidDiagram.tsx
│  │  └─ VaultSidebar.tsx
│  ├─ content/
│  │  └─ guide.ts
│  ├─ lib/
│  │  ├─ agentTools.ts
│  │  ├─ ai.ts
│  │  ├─ auth.ts
│  │  ├─ carrot.ts
│  │  ├─ editorInsert.ts
│  │  ├─ folders.ts
│  │  ├─ graph.ts
│  │  ├─ markdownConnector.ts
│  │  ├─ mermaid.ts
│  │  ├─ notes.ts
│  │  ├─ notionConnector.ts
│  │  ├─ pwa.ts
│  │  └─ storage.ts
│  ├─ types/
│  │  ├─ desktop.d.ts
│  │  └─ index.ts
│  ├─ App.tsx
│  ├─ main.tsx
│  └─ styles.css
├─ tests/
│  ├─ agentTools.test.ts
│  ├─ carrot.test.ts
│  ├─ editorInsert.test.ts
│  ├─ folders.test.ts
│  ├─ graph.test.ts
│  ├─ guide.test.ts
│  ├─ markdownConnector.test.ts
│  ├─ mermaid.test.ts
│  └─ notes.test.ts
├─ .github/workflows/ci.yml
├─ AI.md
├─ ARCHITECTURE.md
├─ CARROT.md
├─ CONNECTORS.md
├─ CONTRIBUTING.md
├─ DESKTOP.md
├─ DEV-NOTES.md
├─ README.md
├─ ROADMAP.md
├─ SECURITY.md
├─ forge.config.cjs
├─ package.json
├─ tsconfig.json
└─ vite.config.ts
```

## Pravidlo závislostí

`components` mohou používat `lib` a `types`. `lib` nesmí importovat UI komponenty.

Provider-specific AI komunikace patří do Python backendu. Privilegované desktop operace patří do Electron main procesu a renderer k nim přistupuje pouze přes úzký `contextBridge`.

Markdown preview používá `react-markdown` + GFM. Mermaid fenced bloky jsou detekované v rendereru a samotný Mermaid runtime se lazy-loaduje pouze tehdy, když je diagram skutečně potřeba.

## Storage a externí zdroje

- IndexedDB je aktuální lokální source of truth pro interní vault.
- Local Markdown, GitHub a Notion fungují jako konektory/import-export zdroje.
- Carrot ukládá lokální auditní snapshoty a hash-chain metadata.
- SQLite backend drží identity, sessions a connector secrets metadata.

Budoucí filesystem vault jako primární source of truth a semantic RAG zůstávají samostatné další vrstvy.
