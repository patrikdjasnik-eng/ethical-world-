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


### Editor UX v4 – one-click Markdown

- přidaný nový `InsertMenu` přímo nad editorem;
- jedním kliknutím lze vložit wiki link na existující poznámku;
- link picker má fulltext nad názvem i folder path;
- code block picker podporuje Bash, PowerShell, Python, TypeScript, JavaScript, JSON, SQL, YAML, C++ a Dockerfile;
- přidané one-click tasky, callouty, heading, tabulka, quote, inline code a divider;
- vložení respektuje aktuální caret/selection;
- vybraný text lze rovnou obalit code blockem, tasky, quote nebo calloutem;
- editor po insertu vrátí focus na správnou pozici;
- přidané unit testy pro deterministické Markdown inserty.

### Pure dark v4

- tmavší neutrální palette bez šedých „mrtvých“ ploch;
- jemné depth vrstvy místo silných gradientů;
- modernější typografie nadpisu poznámky;
- nový floating popover pro insert menu;
- mírné accent glow pouze u interaktivních prvků;
- UI zůstává čitelné i bez aktivního AI panelu.


### Knowledge Graph v2 – Obsidian-level interaction pass

- opravený empty-state: už nikdy neleží přes existující izolovaný uzel;
- graf po stabilizaci a resize automaticky provede zoom-to-fit;
- upravená fyzika: menší charge, delší link distance a stabilnější velocity decay;
- single click uzel focusne a přiblíží;
- double click otevře poznámku;
- pravý klik otevře vlastní node context menu;
- context menu: otevřít note, local graph, kopírovat wiki link, skrýt uzel;
- přidané Labels / Orphans / Folders toggles;
- folder coloring je volitelné, default je čistý neutrální Obsidian-like graph;
- izolované uzly jsou vizuálně tlumené, ale zůstávají součástí globálního grafu;
- hledání na Enter skočí na první odpovídající node;
- přidaný Fit button a restore skrytých uzlů;
- vybraný node zvýrazní sousední hrany a ztlumí zbytek;
- labels mají jemné pozadí kvůli čitelnosti v husté síti.


### Desktop v0.1

- přidaný Electron shell pro Windows;
- browser renderer zůstává zachovaný;
- `contextIsolation` zapnuté, `nodeIntegration` vypnuté, sandbox zapnutý;
- přidaný úzký preload API bridge;
- graph v desktop režimu používá native right-click menu;
- přidaný native folder picker jako základ filesystem vaultu;
- Vite používá relative base, aby produkční build šel načíst přes `file://`;
- `npm run desktop:dev` spustí Vite + Electron;
- `npm run desktop:make` vytvoří lokální Windows distributable;
- `npm run verify` nahrazuje běžný CI gate při lokálním vývoji;
- GitHub Actions workflow je nyní pouze manuální přes `workflow_dispatch`.


### Desktop auto-update v0.1

- přidaný `update-electron-app`;
- updater běží pouze v packaged EXE, nikdy v dev režimu;
- update source je veřejný GitHub repo `patrikdjasnik-eng/ethical-world-`;
- kontrola update proběhne při startu a poté každých 10 minut;
- update se stahuje na pozadí a aplikace nabídne restart;
- přidaný `electron-squirrel-startup` pro korektní Windows Squirrel lifecycle;
- přidaný Electron Forge GitHub Publisher;
- `npm run desktop:publish` vytvoří a publikuje release z lokálního Windows PC;
- GitHub Actions nejsou pro release povinné;
- release vyžaduje vyšší SemVer verzi v `package.json`.


### Knowledge Graph v4 – Obsidian-matched visual pass

- graph canvas přepnutý na ploché `#1e1e1e` pozadí;
- odstraněné glow, radial gradients a velká selection halo;
- uzly jsou malé, neutrálně šedé a vizuálně stabilní při zoomu;
- velikost uzlu roste jen velmi mírně podle degree;
- links jsou tenké a šedé, zvýraznění zůstává pouze při hover/selection;
- labels jsou lehčí, bez tmavých boxů pod textem;
- výchozí aktivní poznámka už není automaticky fialový selected node;
- horní dashboard toolbar byl nahrazen minimálním overlay ovládáním;
- title `Graf` je zobrazený subtilně u horní hrany;
- settings graphu jsou schované pod nenápadným tlačítkem;
- stats jsou pouze drobný text u spodní hrany;
- single-node pohled má omezený zoom, takže uzel nevypadá jako obří logo;
- zachované native right-click menu a všechny Graph v2 interakce.


### Windows desktop shortcut + installer smoke test

- Squirrel install/update lifecycle dál obsluhuje `electron-squirrel-startup`;
- přidaný Windows AppUserModelID `com.squirrel.ethical_world.EthicalWorld`;
- Squirrel setup má deterministický název `EthicalWorldSetup.exe`;
- přidaný `scripts/test-desktop-install.ps1`;
- `npm run desktop:test-install` vytvoří installer, spustí jej a ověří Desktop shortcut;
- test čte skutečný `.lnk` přes Windows COM a validuje target/arguments;
- `npm run desktop:test-install:launch` navíc spustí aplikaci přes Desktop shortcut a ověří proces `EthicalWorld.exe`.


### Squirrel maker executable fix

- opravený nesoulad mezi Packager executableName `EthicalWorld` a Squirrel default executable názvem;
- Squirrel má nyní explicitně `exe: "EthicalWorld.exe"`;
- MSI generování je vypnuté přes `noMsi: true`, protože distribuce používá Squirrel Setup.exe;
- přidané izolované maker příkazy `desktop:make:squirrel` a `desktop:make:zip`;
- installer smoke test při pádu vypíše příkazy pro izolaci konkrétního makeru.


### Máša agent tools v0.1

- přidané permission režimy READ a ASSIST;
- výchozí ASSIST stále vyžaduje explicitní potvrzení každé akce;
- Máša umí navrhnout vytvoření poznámky, úpravu poznámky, vytvoření složky a otevření poznámky;
- strojové akce používají validovaný `ethical-actions` JSON protokol;
- neznámé, nevalidní a malformed akce se nikdy neprovedou;
- model pracuje s přesnými note IDs a seznamem existujících folder paths;
- `masa-cyber` je preferovaný lokální Ollama model, pokud je dostupný;
- mazání a jiné destruktivní tools nejsou v první verzi agentovi zpřístupněné.
