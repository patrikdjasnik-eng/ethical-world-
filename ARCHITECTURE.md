# Architecture

![Architecture](https://img.shields.io/badge/docs-architecture-2563eb)
![Status](https://img.shields.io/badge/status-active-16a34a)
![Version](https://img.shields.io/badge/version-0.1.0-6f42c1)

## Cíl

Ethical World je navržený jako local-first knowledge workspace s oddělenou prezentační, storage a AI vrstvou.

```text
React UI
  ↓
Vault services
  ├─ IndexedDB
  ├─ wiki links
  ├─ backlinks
  └─ search
  ↓
AI client
  ↓
FastAPI gateway
  ↓
Provider router
  ├─ Ollama
  └─ OpenAI-compatible
```

## Frontend

Frontend je React + TypeScript aplikace. Stav poznámek je načten z IndexedDB a aktivní editace se průběžně ukládá. UI má tři hlavní části: vault sidebar, editor/preview a AI panel.

Frontend neobsahuje provider-specific logiku kromě konfiguračních hodnot. Všechny AI požadavky procházejí přes jednotné `/api/chat` rozhraní.

## Storage

v0.1 používá IndexedDB, protože funguje bez serveru a dovoluje offline-first chování. Pozdější desktop verze přidá skutečný filesystem vault s Markdown soubory a kompatibilní import/export.

Zdroj pravdy pro jednu poznámku:

```ts
interface Note {
  id: string;
  title: string;
  content: string;
  folder: string;
  createdAt: string;
  updatedAt: string;
}
```

## Wiki graph

`[[Název poznámky]]` se parsuje na frontendové vrstvě. Backlinks jsou odvozené dynamicky z obsahu vaultu. V budoucnu bude nad stejným modelem postaven globální graph view.

## AI gateway

FastAPI backend chrání frontend před provider-specific API detaily. Provider router přijímá jednotný chat payload a podle konfigurace volá Ollamu nebo OpenAI-compatible endpoint.

AI dostává pouze kontext, který jí klient předá. v0.1 posílá aktivní poznámku a omezený výběr vaultu; další verze přidá embeddings a RAG retrieval.

## Budoucí agent tools

Plánované tools: `searchNotes`, `readNote`, `createNote`, `updateNote`, `linkNotes`, `createTask` a `createCanvas`. Zápisové operace budou používat proposal/diff flow místo tichého přepisu.