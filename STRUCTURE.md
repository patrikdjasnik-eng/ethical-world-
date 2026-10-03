# Repository Structure

![Docs](https://img.shields.io/badge/docs-structure-0ea5e9)
![Status](https://img.shields.io/badge/status-current-16a34a)

```text
ethical-world-/
├─ src/
│  ├─ components/
│  │  ├─ AiPanel.tsx
│  │  ├─ EditorPane.tsx
│  │  └─ VaultSidebar.tsx
│  ├─ lib/
│  │  ├─ ai.ts
│  │  ├─ notes.ts
│  │  └─ storage.ts
│  ├─ types/
│  │  └─ index.ts
│  ├─ App.tsx
│  ├─ main.tsx
│  └─ styles.css
├─ server/
│  ├─ main.py
│  ├─ providers.py
│  └─ requirements.txt
├─ tests/
│  └─ notes.test.ts
├─ .github/workflows/
│  └─ ci.yml
├─ AI.md
├─ ARCHITECTURE.md
├─ CONTRIBUTING.md
├─ DEV-NOTES.md
├─ ROADMAP.md
├─ SECURITY.md
├─ package.json
├─ tsconfig.json
└─ vite.config.ts
```

## Pravidlo závislostí

`components` mohou používat `lib` a `types`. `lib` nesmí importovat UI komponenty. AI provider logika patří do Python backendu, nikoli přímo do React komponent.

## Další rozšíření

Při přidání desktop shellu vznikne samostatná `desktop/` vrstva. Při přidání embeddings vznikne `server/rag/` a provider adaptéry se přesunou do `server/providers/`.