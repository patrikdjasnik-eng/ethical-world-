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

### CI stav

GitHub Actions runy vytvářejí `frontend` i `backend` job, ale v dostupném GitHub API končí před spuštěním workflow kroků a vrací prázdné `steps`. Proto CI zatím není označené jako green.

### Rozhodnutí

- MVP zůstává local-first.
- `main` není pracovní větev.
- Browser MVP používá IndexedDB.
- AI komunikace vede přes lokální FastAPI gateway.
- První providery jsou Ollama a OpenAI-compatible API.
- API klíče se nepersistují ve frontend storage.
- Wiki odkazy používají syntaxi `[[Title]]`.
- Produkční frontend registruje Service Worker, vývojový Vite režim ne.
- Zelený stav Máši nikdy nesmí být dekorativní; znamená ověřený dostupný model.

### Další krok

Lokálně ověřit `npm test`, `npm run build` a `python -m compileall server`. Potom přidat embeddings/RAG a agent tools s diff approval.


### UI redesign – Obsidian-like dark workspace

- levý panel přepracovaný na kompaktní file explorer;
- tmavé neutrální plochy místo gradientního dashboard vzhledu;
- fialová používána jen jako akcent aktivního prvku a odkazů;
- přidaný document tab bar a breadcrumb řádek;
- editor má užší čtecí šířku a typografii vhodnou pro dlouhé poznámky;
- pravý panel Máši vizuálně sjednocený se sekundárním panelem aplikace;
- hover/active stavy jsou subtilnější a blíž desktop knowledge editorům;
- zachovaná veškerá existující logika vaultu, wiki links, backlinks, autosave a AI health-checků.


### Knowledge Graph v1

- přidaný interaktivní 2D force-directed knowledge graph;
- graf je generovaný přímo z `[[wiki links]]` ve vaultu;
- Global režim zobrazuje celý vault;
- Local režim zobrazuje aktivní poznámku a její přímé sousedy;
- velikost uzlu se mění podle počtu vazeb;
- aktivní poznámka má zvýrazněný uzel;
- barvy uzlů jsou deterministicky odvozené od folderu;
- hover zvýrazní lokální síť uzlu a potlačí zbytek;
- kliknutí na uzel otevře příslušnou poznámku;
- podporovaný zoom, pan a drag uzlů;
- vyhledávání v grafu tlumí uzly mimo dotaz;
- statusbar zobrazuje počet uzlů, vazeb a skupin;
- přidané unit testy pro stavbu graph dat, deduplikaci vazeb a local graph.


### Vault explorer v2 – Obsidian-like folders

- IndexedDB schema povýšeno na v2 a přidaný samostatný `folders` store;
- existující poznámky se při migraci automaticky převedou do stromu složek podle hodnoty `folder`;
- podporované root složky i libovolně vnořené podsložky;
- nový file toolbar pro vytvoření poznámky a složky;
- vybraná složka určuje výchozí umístění nové poznámky;
- folder tree podporuje expand/collapse;
- přidané inline vytváření a přejmenování složek;
- přejmenování parent složky aktualizuje descendants i všechny poznámky uvnitř;
- prázdnou složku lze smazat, neprázdná je chráněná před náhodným smazáním;
- poznámku lze přesunout mezi složkami přímo z toolbaru editoru;
- breadcrumb podporuje nested folder path;
- graph i Máša dál pracují nad stejnými poznámkami bez změny datového kontraktu;
- přidané unit testy pro folder path, migraci legacy notes a sestavení folder tree.
