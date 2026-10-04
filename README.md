# Ethical World

![Status](https://img.shields.io/badge/status-v0.1_MVP-6f42c1)
![React](https://img.shields.io/badge/React-TypeScript-149eca)
![AI](https://img.shields.io/badge/AI-local--first-111827)
![Storage](https://img.shields.io/badge/storage-IndexedDB-f59e0b)

Ethical World je local-first knowledge workspace inspirovaný nástroji jako Obsidian, ale AI vrstva je součástí architektury od prvního dne.

Cílem je mít jedno místo pro poznámky, projekty, wiki odkazy a kontextovou AI agentku, která umí pracovat nad aktuálním vaultem bez nutnosti odesílat všechna data do cloudu.

## Aktuální v0.1

- React + TypeScript + Vite.
- Lokální vault nad IndexedDB.
- Vytváření, editace a mazání poznámek.
- Autosave.
- Fulltext vyhledávání.
- `[[wiki links]]` a backlinks.
- Markdown preview včetně lokálně renderovaných Mermaid diagramů.
- AI panel nad aktuální poznámkou a vaultem.
- READ / ASSIST agentní návrhy s approval flow a batch `Použít vše`.
- Lazy-loaded AI panel, který po prvním otevření zachovává chat session i při skrytí.
- Ollama provider.
- OpenAI-compatible provider pro lokální `llama-server` a kompatibilní služby.
- Interaktivní knowledge graph s wiki + related edges.
- Local Markdown, GitHub a Notion connector vrstva.
- Carrot signed history s ověřením obsahu, commit hashe a lokálního chainu.
- Produkční Service Worker pro offline cache.
- API klíč se v UI neukládá do persistentního storage.

## Spuštění

Frontend:

```powershell
npm install
npm run dev
```

Backend:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r server/requirements.txt
uvicorn server.main:app --reload --port 8787
```

Výchozí frontend běží na `http://localhost:5173` a API na `http://localhost:8787`.

Kontrola projektu:

```powershell
npm test
npm run build
python -m compileall server
```

Pro Ollamu nastav v aplikaci například `http://localhost:11434`. Pro `llama-server` použij OpenAI-compatible režim a jeho `/v1` endpoint.

## Dokumentace

- [ARCHITECTURE.md](ARCHITECTURE.md) – technická architektura.
- [STRUCTURE.md](STRUCTURE.md) – struktura repozitáře.
- [AI.md](AI.md) – AI agent, providery a kontext.
- [SECURITY.md](SECURITY.md) – bezpečnostní model.
- [AUDIT.md](AUDIT.md) – poslední hluboký bug/security audit a test plan.
- [ROADMAP.md](ROADMAP.md) – plán dalších verzí.
- [DEV-NOTES.md](DEV-NOTES.md) – průběžný vývojový deník.
- [CONTRIBUTING.md](CONTRIBUTING.md) – pravidla vývoje.

## Princip projektu

Poznámky jsou data uživatele. AI je pomocná vrstva nad nimi, ne vlastník dat. Destruktivní agentní operace budou vždy navržené tak, aby měly preview, diff nebo explicitní potvrzení.