# Development Notes

![Dev Notes](https://img.shields.io/badge/dev--notes-live-0ea5e9)
![Branch](https://img.shields.io/badge/branch-dev%2Ffirst--runnable-6f42c1)
![Date](https://img.shields.io/badge/date-2026--10--03-334155)

## 2026-10-03

Repozitář byl inicializován a vývoj probíhá na `dev/first-runnable`.

### Hotovo

- dokumentace projektu s badge hlavičkami;
- React + TypeScript + Vite základ;
- IndexedDB vault;
- create/edit/delete a autosave;
- fulltext search;
- `[[wiki links]]` a backlinks;
- Markdown preview;
- lazy-loaded AI panel Máša;
- FastAPI AI gateway;
- Ollama + OpenAI-compatible adapter;
- API key prefix hint endpoint;
- produkční Service Worker;
- Vitest testy pro wiki links, backlinks a search;
- GitHub Actions workflow.

### CI stav

První GitHub Actions run vytvořil `frontend` i `backend` job, ale oba skončily během několika sekund ještě před spuštěním workflow kroků. GitHub API vrací pro joby prázdné `steps` a job log není dostupný. Proto zatím nelze tvrdit, že CI je green ani z tohoto runu odvozovat chybu aplikace.

Backend `server/main.py` byl dodatečně ověřen syntaktickou kompilací mimo GitHub Actions.

### Rozhodnutí

- MVP zůstává local-first.
- `main` nebude použit jako pracovní větev.
- Browser MVP používá IndexedDB.
- AI komunikace vede přes lokální FastAPI gateway.
- První providery jsou Ollama a OpenAI-compatible API.
- API klíče se nepersistují ve frontend storage.
- Wiki odkazy používají syntaxi `[[Title]]`.
- Produkční frontend registruje Service Worker, vývojový Vite režim ne.

### Další krok

Spustit lokálně `npm test`, `npm run build` a `python -m compileall server`. Po green buildu přidat embeddings/RAG a následně agent tools s diff approval.