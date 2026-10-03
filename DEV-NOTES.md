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
- GitHub Actions workflow;
- skutečný health-check AI gateway;
- autodetekce Ollamy na `localhost:11434`;
- autodetekce OpenAI-compatible `llama-server` na `localhost:8080/v1`;
- automatický výběr nalezeného lokálního modelu;
- pravidelná kontrola stavu modelu po 10 sekundách;
- jasné UI stavy Máši: online / LLM offline / backend offline;
- blokace odeslání zprávy, pokud žádný LLM skutečně neodpovídá.

### AI status flow

```text
Ethical World UI
  ↓
FastAPI /health
  ↓
/api/providers/auto-detect
  ├─ Ollama :11434
  └─ llama-server :8080/v1
  ↓
provider /models nebo /api/tags
  ↓
Máša ONLINE pouze pokud byl nalezen skutečný model
```

### Knowledge Graph v1

- interaktivní 2D force-directed knowledge graph;
- graf je generovaný z `[[wiki links]]`;
- Global a Local režim;
- velikost uzlu podle počtu vazeb;
- hover neighborhood highlighting;
- kliknutí na uzel otevře poznámku;
- zoom, pan a drag uzlů;
- folder barvy, vyhledávání a statusbar.

### Vault explorer v2

- IndexedDB schema v2 s `folders` store;
- root složky i libovolně vnořené podsložky;
- inline create/rename folder;
- drag & drop poznámek;
- bezpečné mazání neprázdných složek;
- přesun poznámky přes folder selector;
- Ctrl+N nová poznámka;
- Ctrl+Shift+N nová složka;
- breadcrumb nested paths.

### UI redesign v3 – desktop workbench

- nový horní workspace topbar;
- nový levý activity rail;
- Files panel lze zavřít přes rail nebo Ctrl+B;
- Mášu lze zavřít přes rail nebo Ctrl+J;
- workspace automaticky využije uvolněné místo po zavření panelu;
- Files panel je kompaktní a už neduplikuje hlavní navigaci;
- texty a ovládací prvky jsou větší a čitelnější než v předchozí verzi;
- tmavé vrstvy jsou jasněji oddělené bez velkých gradientních ploch;
- graph používá jemný grid canvas a nový prázdný stav bez plovoucí karty;
- responsive režim přepíná panely na overlay místo zmenšení obsahu.

### CI stav

GitHub Actions workflow zůstává nakonfigurovaný, ale dostupné runy dříve končily před spuštěním workflow kroků. Lokální `npm test` a `npm run build` je proto stále potřeba ověřit na checkoutu.
