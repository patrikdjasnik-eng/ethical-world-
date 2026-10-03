# Development Notes

![Dev Notes](https://img.shields.io/badge/dev--notes-live-0ea5e9)
![Branch](https://img.shields.io/badge/branch-dev%2Ffirst--runnable-6f42c1)
![Date](https://img.shields.io/badge/date-2026--10--03-334155)

## 2026-10-03

Repozitář byl inicializován a vývoj probíhá na `dev/first-runnable`.

### Rozhodnutí

- MVP zůstává local-first.
- `main` nebude použit jako pracovní větev.
- Browser MVP používá IndexedDB.
- AI komunikace vede přes lokální FastAPI gateway.
- První providery jsou Ollama a OpenAI-compatible API.
- API klíče se nepersistují ve frontend storage.
- Wiki odkazy používají syntaxi `[[Title]]`.

### Scope first runnable

Vault sidebar, editor, Markdown preview, backlinks, search, AI chat, settings pro provider/model/endpoint, testy a CI.

### Další krok

Po ověření prvního buildu doplnit embeddings/RAG a následně agent tools s diff approval.