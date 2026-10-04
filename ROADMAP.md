# Roadmap

![Roadmap](https://img.shields.io/badge/roadmap-active-7c3aed)
![MVP](https://img.shields.io/badge/current-v0.1-16a34a)

## v0.1 – First runnable

- [x] React + TypeScript + Vite.
- [x] Local IndexedDB vault.
- [x] Create/edit/delete notes.
- [x] Autosave.
- [x] Fulltext search.
- [x] Wiki links a backlinks.
- [x] Markdown preview.
- [x] Lokální Mermaid rendering v Markdown preview.
- [x] AI chat panel Máša.
- [x] Lazy loading AI panelu.
- [x] Schování a znovuotevření Máši bez ztráty chat session.
- [x] Ollama provider.
- [x] OpenAI-compatible provider.
- [x] Produkční Service Worker.
- [x] Automatický CI workflow pro push/PR + manual run.
- [ ] Potvrzený green GitHub Actions run – GitHub runner aktuálně ukončuje oba joby ještě před prvním krokem.

## v0.2 – Real knowledge retrieval

- [ ] Embeddings.
- [ ] Chunking.
- [ ] Semantic search.
- [ ] RAG citations.
- [ ] AI related-note suggestions.
- [ ] Provider verification wizard.

## v0.3 – Agent mode

- [x] Omezený vault context + vault index.
- [x] `create_note` action.
- [x] `update_note` proposal podle přesného note ID.
- [x] `create_folder` action.
- [x] `open_note` action.
- [x] READ / ASSIST permission gate.
- [x] Jednotlivé approval.
- [x] `Použít vše` pro batch návrhy.
- [x] Knowledge Note envelope parser.
- [ ] Explicitní `searchNotes` tool.
- [ ] Explicitní `readNote` tool.
- [ ] Rich diff approval.
- [ ] AI tagging.
- [ ] Streaming / progress orchestrace.

## v0.4 – Knowledge OS

- [x] Interaktivní Graph view.
- [x] Wiki edges.
- [x] Heuristické related edges.
- [ ] AI semantic graph / embeddings.
- [ ] Canvas.
- [ ] Tasks.
- [ ] Daily notes.
- [ ] Templates.

## v0.5 – Desktop, connectors a historie

- [x] Electron desktop shell.
- [x] Local Markdown connector.
- [x] GitHub Markdown connector.
- [x] Notion connector backend + OAuth flow.
- [x] Carrot lokální signed Markdown history.
- [x] Carrot snapshot/commit integrity verification.
- [x] PWA/offline service worker základ.
- [x] Windows standalone/installer práce byla dokončena před dnešním scope.
- [ ] Filesystem Markdown vault jako primární source of truth.
- [ ] Obsidian-compatible plný import/export.
- [ ] Remote/append-only transparency log pro Carrot.
- [ ] Optional encrypted sync.
