# Development Notes

![Dev Notes](https://img.shields.io/badge/dev--notes-live-0ea5e9)
![Branch](https://img.shields.io/badge/branch-dev%2Ffirst--runnable-6f42c1)
![Date](https://img.shields.io/badge/date-2026--10--04-334155)

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


### Identity DB foundation v0.1

- přidaná lokální SQLite databáze mimo Git repozitář;
- registrace a login endpointy;
- hesla používají scrypt + unikátní salt;
- session tokeny jsou v DB uložené pouze jako SHA-256 hash;
- admin účet lze bootstrapnout výhradně přes environment variables;
- přidané tabulky devices a ciphertext-only message_envelopes jako základ budoucího E2E chatu;
- dokumentace výslovně zakazuje vlastní neauditovanou kryptografii pro budoucí team messaging.


### Máša chat UX v0.2

- automatický scroll na poslední zprávu;
- Enter odesílá, Shift+Enter přidá nový řádek;
- odpovědi Máši mají copy akci;
- běžný dotaz ukazuje `Přemýšlím nad odpovědí…`; 
- požadavek na změnu ukazuje `Připravuju změnu v Ethical World…`; 
- system prompt už není omezený pouze na vault a dovoluje obecné technické/cybersecurity vysvětlování.

### Connectors v0.1

- nový Connectors workspace;
- funkční Local / VS Code Markdown import/export;
- session-scoped filesystem root + path traversal ochrana;
- GitHub Device OAuth;
- GitHub token přes Electron OS safeStorage;
- GitHub Markdown-only import bez clone;
- GitHub Markdown export jako jeden commit;
- Notion public OAuth ponechán server-side kvůli client secretu.

### Account UI v0.1

- registrace a login přes FastAPI identity DB;
- session restore po restartu desktopu;
- session token desktop ukládá přes OS safeStorage;
- browser fallback používá pouze sessionStorage;
- account view je dostupný přes spodní Settings/Account ikonu.

### Máša Knowledge Engineer v0.2

- přidaný raw `<ethical-note>` envelope pro dlouhé Markdown dokumenty bez JSON escapování;
- knowledge note output limit navýšený na 6144 tokenů;
- AI-authored note dostává programově Ethical World / Máša / Markdown badges;
- Máša dostává index až 500 poznámek pro rozhodování o wiki vazbách;
- neexistující AI wiki link se před uložením převede na obyčejný text;
- Mermaid diagramy se používají podle významu architektury/flow;
- Prisma schema se používá u databázových a backendových modelů, ne mechanicky;
- knowledge notes podporují plné code blocks, tabulky, checklisty a návazné poznámky;
- přidané testy pro Mermaid, Prisma, badges, wiki link validation a full-note update.

### In-app Guide + Updates v0.1

- nová Guide záložka v activity railu;
- přepínač CZ / EN;
- sekce Začínáme, Máša, Knowledge Notes, Connectors a Accounts/Security;
- samostatná Updates záložka s verzovaným seznamem změn;
- guide data jsou centralizovaná v `src/content/guide.ts`, aby se aktualizovala spolu s releasy;
- přidaný test bilingvního guide/update obsahu.


### Desktop runtime v0.2

- Electron při startu nejdřív ověří `127.0.0.1:8787/health`;
- pokud gateway neběží, dev build ji sám spustí z projektového `.venv`;
- packaged build preferuje přibalený `EthicalWorldBackend.exe`;
- standalone backend build používá PyInstaller a je dostupný přes `npm run desktop:backend:build`;
- `npm run desktop:make:standalone` vytvoří backend EXE a následně desktop distributable;
- system Python je pouze fallback, ne cílová produkční závislost;
- GitHub OAuth Client ID `Ov23liJffFw6fPudRTQ1` je zabudovaný jako veřejný default.

### Notion connector v0.2

- server-side OAuth start + callback;
- OAuth access payload se ukládá šifrovaně v SQLite `connector_secrets`;
- výpis přístupných Notion pages;
- přímý Markdown import přes Notion page Markdown endpoint;
- zápis importované note zpět přes `replace_content`;
- renderer nikdy nedostává Notion access token;
- Notion Client Secret zůstává pouze v backend environment.

### Owner onboarding v0.2

- databázová migrace přidává role a `must_change_password`;
- pokud neexistuje owner, vytvoří se lokální `owner@ethical.world.local`;
- bootstrap owner nepoužívá univerzální default heslo;
- první lokální owner session je časově omezená a aplikace se zamkne na Account view;
- odemčení vyžaduje vlastní heslo alespoň 12 znaků;
- po změně hesla se bootstrap login vypne.

### Máša compact dock v0.3

- AI panel už není samostatný pravý grid sloupec;
- plave jako kompaktní dock vpravo dole;
- editor při otevření Máši neztrácí šířku;
- mobilní režim používá spodní sheet velikost;
- chat scroll, copy, Enter a ASSIST/Knowledge Note flow zůstávají zachované.

### Ethical World identity mark v0.1

- přidaný vlastní SVG shield + knowledge graph mark;
- topbar používá SVG místo textového E;
- stejný mark je v Identity view a faviconu;
- SVG zůstává master asset pro budoucí převod na installer ICO.


### Carrot history v0.1

- IndexedDB schema zvýšené na v3 s `carrotCommits` store;
- každý Markdown snapshot má autora, čas, message a SHA-256 snapshot hash;
- Carrot commit ukládá `parentId`, `commitHash` a `parentCommitHash`;
- stejné snapshoty se neduplikují;
- desktop generuje per-device Ed25519 keypair;
- private key je uložený přes Electron `safeStorage`;
- podpis pokrývá metadata, snapshot hash a parent commit hash;
- editor má `🥕 Carrot` historii s náhledem kompletního staršího Markdownu;
- historie zobrazuje autora, commit hash, key fingerprint a stav ověření podpisu;
- Carrot zachycuje autosave, vytvoření note, přesun, connector import i změny provedené Mášou.

### Rabbithollow Code Studio™ branding + licence

- aplikace zobrazuje nenápadné `Created by Rabbithollow Code Studio™`;
- přidána vlastní source-available licence;
- licence povoluje používání neupraveného Ethical World, ale bez písemného souhlasu zakazuje modifikace, deriváty, rebrand/white-label a redistribuci;
- User Content zůstává mimo vlastnické nároky licence;
- přidaný `TRADEMARKS.md` pro Ethical World™ a Rabbithollow Code Studio™;
- licence je source-available/proprietary, nikoli open-source.


---

## 2026-10-04 — desktop milestone, Máša agent workflow, Carrot a knowledge graph

![Desktop](https://img.shields.io/badge/desktop-standalone_backend-47848F)
![Máša](https://img.shields.io/badge/M%C3%A1%C5%A1a-agentic_knowledge_engineer-6f42c1)
![Carrot](https://img.shields.io/badge/Carrot-signed_history-f97316)
![Graph](https://img.shields.io/badge/graph-wiki_%2B_related-64748b)
![Security](https://img.shields.io/badge/security-approval_gated-16a34a)

Dnešní práce uzavřela několik samostatných vývojových větví do jednoho funkčního desktopového flow. Hlavní cíl byl dostat Ethical World blíž k aplikaci, kterou uživatel spustí jako normální Windows program a většinu práce provádí uvnitř UI bez ručního spouštění backendu nebo editace Markdownu mimo aplikaci.

Aktuální vývojová větev: `dev/first-runnable`.

### Standalone Windows runtime — reálně ověřeno

- FastAPI gateway už nemusí být ručně spouštěná přes `uvicorn` v samostatném PowerShell okně.
- Electron při startu kontroluje `http://127.0.0.1:8787/health`.
- Pokud backend neběží, desktop runtime se ho pokusí spustit automaticky.
- V dev režimu se preferuje projektový `.venv\Scripts\python.exe`.
- Pro packaged build vzniká samostatný `EthicalWorldBackend.exe` přes PyInstaller.
- Standalone backend je balený do:
  `resources/backend/EthicalWorldBackend.exe`.
- Přidané build příkazy:
  - `npm run desktop:backend:build`
  - `npm run desktop:package:standalone`
  - `npm run desktop:make:standalone`
- GitHub OAuth Client ID je veřejný konfigurační údaj a je nyní dostupný jako default přímo v desktop runtime:
  `Ov23liJffFw6fPudRTQ1`.
- Client Secret se do Electron bundle nevkládá.

#### Ověřený runtime test

Po spuštění packaged `EthicalWorld.exe` byl na portu `8787` nalezen proces:

```text
ProcessName: EthicalWorldBackend
Path: ...\out\Ethical World-win32-x64\resources\backend\EthicalWorldBackend.exe
```

Tím je potvrzené, že packaged desktop opravdu spouští vlastní přibalený backend bez ručního PowerShell/uvicorn workflow.

#### Packaging stav

- Vite produkční build prošel.
- Electron packaging pro `win32/x64` prošel.
- Squirrel vytvořil:
  - `EthicalWorldSetup.exe`
  - `ethical_world-0.1.0-full.nupkg`
  - `RELEASES`
- Standalone backend byl fyzicky přítomný v packaged resources.
- Celkový `make` ale v posledním testu vrátil `LASTEXITCODE = 1`.
- Squirrel artifacts existují; ZIP distributable v daném běhu nebyl potvrzený.
- Před release je potřeba ještě izolovat ZIP maker / postMake stav a vrátit celý make do green.

### Owner onboarding a identity flow

- SQLite users DB dostala role `owner | user`.
- Přidán `mustChangePassword`.
- Pokud databáze nemá owner účet, vytvoří se lokální bootstrap owner:
  `owner@ethical.world.local`.
- Neexistuje commitnuté univerzální default heslo.
- Bootstrap owner dostane krátkodobou session.
- Při prvním přihlášení je aplikace zamknutá do Identity/Account flow.
- Odemčení vyžaduje nové vlastní heslo alespoň 12 znaků.
- Po změně hesla se first-login bootstrap vypne.
- UI AccountPanel propaguje aktuální user identity zpět do App state.
- Owner/user identity se používá i jako autor Carrot commitů.

### Notion Markdown connector

- Dokončený server-side Notion OAuth flow.
- Client Secret zůstává pouze v backend prostředí.
- OAuth payload se ukládá do `connector_secrets` šifrovaně.
- Renderer access token nikdy nedostává.
- Implementováno:
  - status;
  - OAuth start;
  - callback;
  - list pages;
  - import vybrané page jako Markdown note;
  - write-back přes Notion enhanced Markdown API;
  - disconnect.
- Notion UI karta umí připojit workspace, vybrat page, importovat a exportovat zpět.
- Reálné přihlášení čeká na vlastní Notion OAuth Client ID + Client Secret.

### GitHub connector

- GitHub Device OAuth zůstává desktop-native bez Client Secretu.
- Veřejný Ethical World GitHub Client ID je součástí desktop konfigurace.
- Token se ukládá přes Electron `safeStorage`.
- Import/export pracuje pouze s Markdownem, ne s projektovým source tree.
- Export zapisuje Markdown do vybraného repozitáře GitHub API commitem.

### Máša — Knowledge Engineer

Máša už není jen chat nad vaultem. Aktuální cíl je, aby uměla na základě přirozeného LLM vstupu připravovat celé strukturované knowledge dokumenty a navazující změny projektu.

#### Knowledge Note protocol

Přidaný raw envelope:

```text
<ethical-note>
{"action":"create|update","title":"...","noteId":"...","folder":"..."}
<content>
raw Markdown
</content>
</ethical-note>
```

Výhody:

- Markdown uvnitř nemusí být JSON escaped;
- fungují trojité code fences;
- lze generovat Mermaid;
- lze generovat Prisma schema;
- lze vložit Bash / PowerShell / Python / TypeScript / JSON a další code blocks;
- knowledge note může být výrazně delší než běžná chat odpověď;
- AI note dostává Ethical World / Máša / Markdown GitHub-style badge hlavičku programově.

Knowledge Note generation má aktuálně output budget až 6144 tokenů.

### Multi-note generation

Dnešní reálný test odkryl, že lokální model uměl odpovědět vlastním legacy schema:

```json
{
  "action": "create_note",
  "note": {
    "title": "...",
    "content": "..."
  }
}
```

zatímco původní parser očekával:

```json
{
  "type": "create_note",
  "title": "...",
  "content": "..."
}
```

Parser byl proto rozšířený o kompatibilní normalizační vrstvu.

Podporované jsou nyní i varianty:

- `action + note`;
- `create_notes + notes[]`;
- více samostatných knowledge-note envelope bloků;
- standardní `type=create_note`;
- standardní `type=update_note`.

Požadavek na tři poznámky má nově znamenat:

```text
3 témata
→ 3 samostatné Markdown dokumenty
→ 3 samostatné agent actions
→ 3 approval karty
→ teprve potom zápis do vaultu
```

Model dostal explicitní zákaz slepit více požadovaných notes do jednoho dokumentu s opakovanými nadpisy.

### Máša — navazující questy a update workflow

Další reálný test ukázal, že příkazy typu:

- „doplň to do všech tří MD“;
- „zakresli do nich...“;
- „vlož do poznámek...“;
- „zapracuj to do těch tří“;
- „rozšiř ty poznámky“;

končily jen jako textová odpověď v chatu místo změny souborů.

Router proto dostal další akční slovesa:

`doplň, vlož, zapracuj, zakresli, rozšiř, aktualizuj, edit, append` a další české varianty.

Navazující editace mají nově:

1. použít poslední konverzaci;
2. použít `VAULT INDEX`;
3. použít obsah nedávno upravených notes;
4. najít přesná note IDs;
5. vrátit samostatný `update_note` / `<ethical-note action=update>` pro každý cíl;
6. čekat na explicitní potvrzení uživatele.

`sendAiMessage()` už neposílá náhodných prvních 12 notes. Kontext se skládá z:

- aktivní note;
- nejčerstvěji upravených notes;
- deduplikace podle ID;
- až 20 notes;
- až 5000 znaků na kontextovou note.

To má zlepšit follow-up práci typu „teď uprav ty tři, které jsi právě vytvořila“.

### Cybersecurity educational scope Máši

Máša může edukativně probírat:

- malware behavior;
- ransomware;
- worms;
- trojans;
- reverse engineering;
- exploit concepts;
- web security;
- threat hunting;
- detection engineering;
- ofenzivní a defenzivní principy.

Pro zápis do knowledge notes má používat bezpečné laboratorní simulace, pseudokód, detekční a obranné příklady.

Při požadavku, který by vytvořil přímo destruktivní payload, credential theft, persistence nebo síťové šíření mimo autorizovaný lab, má operační část převést na bezpečnou simulaci.

### Máša UX — compact dock

- chat už nebere trvale celý pravý sloupec workspace;
- funguje jako floating panel vpravo dole;
- editor se při otevření Máši nezúží;
- zachováno:
  - Enter send;
  - Shift+Enter newline;
  - copy assistant message;
  - READ / ASSIST;
  - approval cards;
  - online/offline status;
  - knowledge generation state.

Aktuální slabina: dlouhá multi-note generace na lokálním 7B modelu působí pomalu, protože backend používá non-streaming odpověď a UI čeká na celý výsledek.

### Carrot signed Markdown history

Carrot je vlastní Ethical World historie Markdown dokumentů.

Aktuální model:

```text
note snapshot
  ↓
snapshotHash SHA-256
  ↓
parentCommitHash
  ↓
commitHash SHA-256
  ↓
Ed25519 signature
  ↓
Carrot history
```

Carrot commit obsahuje mimo jiné:

- note ID;
- parent ID;
- title;
- folder;
- celý Markdown snapshot;
- snapshot hash;
- commit hash;
- parent commit hash;
- message;
- author user ID;
- author display name;
- timestamp;
- signature algorithm;
- signature;
- public key;
- key fingerprint.

Desktop při prvním podpisu vytvoří per-device Ed25519 keypair.

- private key → Electron OS `safeStorage`;
- public key → commit metadata;
- renderer private key nikdy nedostává.

Carrot zaznamenává:

- autosave po idle;
- vytvoření note;
- přesun note;
- folder změny;
- connector import;
- změny provedené Mášou.

Identický snapshot se podruhé neukládá.

### Carrot UI fix

První verze Carrot History byla vložená inline do editoru a při otevření rozbíjela layout.

Opraveno:

- Carrot je nyní floating window;
- editor se při otevření nepohne;
- panel má vlastní scroll;
- panel lze táhnout za header;
- pozice je omezena na viewport;
- přidané:
  - `Obnovit`;
  - `Reset`;
  - `× Zavřít`;
- mobilní breakpoint používá fixovaný sheet režim.

### Knowledge Graph — Obsidian-like pavučina

Původní graph engine uměl force-directed layout, ale hrany vznikaly pouze z explicitních `[[wiki links]]`.

V reálném testu tedy tři nové malware notes existovaly jen jako izolované uzly.

Graph byl rozšířený o dvě úrovně vztahů:

#### 1. Wiki link

Pevná skutečná vazba vytvořená Markdownem:

```md
[[Malware Script - Ransomware]]
```

#### 2. Related link

Jemná automaticky odvozená vazba podle:

- token overlap v názvu;
- Markdown tag overlap;
- stejného non-root folderu.

Graph UI dostal nový přepínač:

`Tematické vazby`

a rozlišuje:

- wiki link;
- related link.

Stats ukazují samostatně počet `wiki` a `related` vazeb.

### Wiki link parser

`extractWikiLinks()` nyní správně normalizuje i:

```md
[[Poznámka|alias]]
[[Poznámka#Sekce]]
```

Graph tedy hledá cílovou note podle skutečného názvu místo celého raw wiki targetu.

### Batch wiki linking Máši

Knowledge-note parser byl připravený tak, aby v rámci jednoho multi-note batch requestu zachoval i wiki odkazy mezi právě vznikajícími notes.

Cíl:

```text
Ransomware
 ↕
Worm
 ↕
Trojan
```

nemá být jen tematicky podobný graph, ale postupně skutečná knowledge network vytvořená přímo Markdown odkazy.

Máša má při generování tematicky související série poznámek přidávat přirozené `[[wiki links]]` na přesné názvy ostatních notes stejného batch requestu.

### Ethical World brand

- vytvořený vlastní SVG mark:
  - shield;
  - knowledge graph;
  - tmavá/fialová Ethical World identita.
- použitý v:
  - topbaru;
  - Account / Identity view;
  - browser faviconu.
- UI obsahuje:
  `Created by Rabbithollow Code Studio™`.

SVG je zatím master asset. Nativní Windows `.ico` integrace ještě není dokončená.

### Licence a contribution model

Na `main` i `dev/first-runnable` jsou:

- `LICENSE`;
- `TRADEMARKS.md`.

Aktuální model je source-available / proprietary, nikoli OSI open source.

Cíl licence:

- uživatel může Ethical World používat;
- nesmí vzít projekt, přebrandovat ho a vydat jako vlastní produkt;
- bez svolení nesmí vytvářet white-label / competing derivative;
- User Content zůstává uživateli;
- Rabbithollow Code Studio™ / Ethical World™ branding není převodem source kódu licencovaný.

Bylo rozhodnuto, že contribution model ještě upravíme tak, aby:

- kdokoliv mohl fork/edit/test pro účel příspěvku;
- kdokoliv mohl poslat Pull Request;
- contributor nesměl fork vydávat jako vlastní produkt;
- přidal se contribution exception + CLA;
- třetí MIT komponenty měly vlastní `THIRD_PARTY_NOTICES.md`.

### Open-source integrace připravené k pozdější analýze/implementaci

Pro budoucí rozšíření byly vybrané:

1. Defuddle — HTML / URL → čistý Markdown;
2. Knap — Markdown templates;
3. JSON Canvas — otevřený `.canvas` knowledge format;
4. Obsidian Importer adapters;
5. vlastní Ethical World Web Clipper;
6. MapLibre / Obsidian Maps-inspired MapPane.

Všechny vybrané upstream projekty používají MIT licenci, ale jejich notices musí zůstat zachované.

---

## Známé problémy / neuzavřené body po dnešku

- Multi-note generation je na lokálním modelu pomalá.
- Ollama request je stále `stream: false`; uživatel dlouho vidí pouze pracovní stav.
- Máša neumí zatím progress typu `1/3 notes hotovo`.
- Follow-up agent workflow je stále hodně závislý na kvalitě lokálního modelu.
- Graph related similarity je první heuristická verze a bude chtít ladění vah/thresholdů.
- Carrot je lokální audit log; není remote transparency log.
- Standalone Squirrel installer existuje a backend runtime je ověřený, ale celý `make` musí ještě projít s exit code 0.
- ZIP maker nebyl v posledním packaging běhu potvrzený.
- Notion potřebuje vlastní OAuth credentials.
- Ethical World má SVG brand mark, ale Windows executable/shortcut zatím nemá finální vlastní `.ico`.

---

## Questy na 2026-10-05

### 1. Zrychlit Mášu / orchestrace

Priorita číslo jedna.

Probrat a implementovat jednu nebo kombinaci možností:

- token streaming z Ollamy do UI;
- SSE nebo NDJSON stream endpoint z FastAPI;
- progress stav pro dlouhé agent úlohy;
- multi-note generace jako sekvenční job:
  `1/3 → 2/3 → 3/3`;
- oddělit planner od writeru;
- lehký orchestration layer:
  - router;
  - planner;
  - note writer;
  - graph linker;
  - verifier;
- paralelizovat pouze operace, které nezvyšují VRAM nároky nepřijatelně;
- zkrátit opakovaný prompt/context;
- posílat pouze relevantní notes místo velkého vault dumpu;
- případně použít menší model na routing/planning a `masa-cyber` pouze na content generation;
- měřit time-to-first-token, tokens/s a total task time.

Cíl: i když samotný 7B model nebude dramaticky rychlejší, uživatel musí průběžně vidět, že Máša skutečně pracuje.

#### AI Booster — multi-model Máša

![AI Booster](https://img.shields.io/badge/AI_Booster-multi--model_orchestration-7c3aed)
![Local](https://img.shields.io/badge/local--first-GGUF-16a34a)
![Routing](https://img.shields.io/badge/routing-role--based-2563eb)

Cíl není nahradit současnou Mášu jedním větším modelem, ale rozdělit práci podle silných stránek jednotlivých modelů. Modely se nemají automaticky spouštět všechny na každý prompt. Router má vybrat pouze model nebo sekvenci modelů, která dává pro konkrétní úkol smysl.

Plánované role:

```text
uživatel
  ↓
task router
  ├─ běžná odpověď / cyber → masa-cyber
  ├─ plán / struktura / knowledge writing → Synthia 7B
  └─ těžké reasoning / review / judge → Nous-Hermes-2-Mixtral 8x7B
  ↓
deterministický verifier
  ↓
ASSIST approval
  ↓
vault + Carrot
```

Toppy-M 7B je z tohoto plánu vyřazený. Nechceme na něm stavět produkční orchestraci.

##### Synthia 7B v1.3

Referenční varianta:

`TheBloke/Synthia-7B-v1.3-GGUF`

Základní fakta:

- 7B model z Mistral rodiny;
- dostupný jako GGUF a použitelný přes `llama.cpp`, Ollama a OpenAI-compatible lokální runtime;
- licence publikované GGUF varianty: Apache-2.0;
- `Q4_K_M` má přibližně 4.37 GB;
- referenční tabulka uvádí přibližně 6.87 GB maximální RAM bez GPU offloadu;
- `Q5_K_M` má přibližně 5.13 GB a nižší kvantizační ztrátu;
- `Q2_K` je menší, ale model card ho kvůli výrazné ztrátě kvality nedoporučuje pro běžné použití.

Plánovaná role v Máše:

- rychlý planner;
- návrh struktury knowledge notes;
- dlouhé vysvětlující Markdown dokumenty;
- rewrite a sjednocování stylu;
- rozdělení multi-note úkolu na menší kroky;
- příprava osnovy před předáním specializovanému modelu.

Očekávané silné stránky:

- výrazně menší paměťové nároky než Mixtral;
- vhodnější pro lokální provoz na běžném PC;
- dobrý kandidát pro úlohy, kde je důležitá struktura, čitelnost a instruction following;
- nízká cena přepnutí modelu při lokálním GGUF provozu;
- rozumný kandidát na rychlou první vrstvu orchestrace.

Slabiny / co nesmíme předpokládat bez benchmarku:

- 7B model nemá být automaticky považovaný za nejlepší model pro hluboké reasoning;
- není vhodné mu bez další kontroly svěřit finální bezpečnostní rozhodnutí;
- u složitějšího codingu, dlouhých dependency chainů a více-krokového reasoning může být slabší než větší Mixtral;
- factual accuracy, češtinu, code generation a stabilitu dlouhého kontextu musíme změřit přímo v Ethical World;
- model nesmí být jediný verifier agentních akcí.

Doporučený první test:

- GGUF `Q4_K_M`;
- změřit cold start;
- time-to-first-token;
- tokens/s;
- RAM;
- VRAM;
- kvalitu 20 standardizovaných Máša úloh;
- porovnat proti `masa-cyber` na stejném prompt setu.

##### Nous-Hermes-2-Mixtral 8x7B DPO

Referenční varianta:

`NousResearch/Nous-Hermes-2-Mixtral-8x7B-DPO`

GGUF reference:

`TheBloke/Nous-Hermes-2-Mixtral-8x7B-DPO-GGUF`

Základní fakta:

- fine-tune nad Mixtral 8x7B Mixture-of-Experts architekturou;
- SFT + DPO varianta;
- model card uvádí trénink na více než 1 000 000 položkách, převážně GPT-4 generovaných a dalších kvalitních datasetech;
- používá ChatML prompt format;
- licence: Apache-2.0;
- autor modelu uvádí zlepšení v řadě benchmarků proti Mixtral Instruct v0.1;
- `Q4_K_M` GGUF má přibližně 28.45 GB a referenční maximální RAM bez GPU offloadu přibližně 30.95 GB;
- i `Q2_K` má přibližně 17.31 GB a model card u něj uvádí významnou ztrátu kvality;
- `Q3_K_M` má přibližně 22.54 GB a stále vysokou kvalitativní ztrátu proti vyšším quantům.

Plánovaná role v Máše:

- heavyweight reasoning;
- komplikované plánování;
- second-pass review;
- posouzení více návrhů;
- architektonický návrh;
- složitější debugging;
- případný judge pro úlohy, kde menší model není dostatečně jistý.

Očekávané silné stránky:

- vyšší reasoning kapacita než 7B vrstva;
- MoE architektura je vhodná pro širší směs komplexních úloh;
- silnější kandidát pro komplikované multi-step instrukce;
- ChatML dobře zapadá do strukturovaného multi-turn orchestration flow;
- vhodný jako volitelný expert místo modelu, který by běžel permanentně.

Slabiny:

- výrazně vyšší RAM/VRAM nároky;
- vysoká latence při CPU offloadu;
- nevhodný jako defaultní model na low-end zařízení;
- na slabším PC by mohl zhoršit UX místo toho, aby Mášu zrychlil;
- příliš agresivní quantizace snižuje hlavní důvod, proč tento velký model vůbec použít;
- nesmí blokovat základní lokální režim aplikace.

Nasazení proto rozdělíme na profily:

```text
LOW / LOCAL
masa-cyber + Synthia 7B

BALANCED
masa-cyber + Synthia 7B
Nous-Hermes pouze pokud hardware probe projde

HEAVY
masa-cyber + Synthia 7B + Nous-Hermes Mixtral

REMOTE HEAVY
Nous-Hermes přes OpenAI-compatible endpoint na jiném stroji/serveru
```

##### Orchestration pravidla

První verze AI Boosteru má být role-based, ne voting ensemble.

Příklady:

```text
"Vysvětli mi X"
→ masa-cyber nebo Synthia podle tématu

"Vytvoř tři propojené knowledge notes"
→ Synthia: planner
→ masa-cyber: odborný obsah podle tématu
→ parser/verifier: deterministic validation
→ approvals

"Navrhni architekturu a najdi slabiny"
→ Synthia: první plán
→ Nous-Hermes: review pouze pokud je dostupný
→ deterministic verifier

"Uprav ty tři předchozí MD"
→ router
→ Synthia / masa-cyber podle typu změny
→ přesná note IDs
→ approval
```

Model nesmí sám rozhodovat o oprávnění k zápisu. READ / ASSIST permission gate, validace note IDs, folder scope, wiki links, Carrot a další bezpečnostní kontroly zůstávají deterministickou vrstvou aplikace.

##### Czech Quality Layer

Cíl: model nesmí pouze "odpovídat česky". Má generovat přirozenou, technicky přesnou a konzistentní češtinu bez doslovných anglických konstrukcí, divných skloňování a náhodného přepínání do angličtiny.

Čeština bude řešená jako samostatná kvalita orchestrace:

```text
prompt
  ↓
language intent detector
  ↓
Czech system profile
  ↓
vybraný model
  ↓
Czech language verifier
  ↓
pokud kvalita neprojde
  → Czech rewrite pass
  ↓
finální odpověď
```

Základní pravidla:

- pokud uživatel píše česky, výchozí odpověď je česky;
- technické názvy, API, knihovny, příkazy, názvy tříd a kód se nepřekládají násilně;
- anglické odborné termíny mohou zůstat, pokud je to přirozenější než umělý český překlad;
- model nesmí míchat češtinu a angličtinu uvnitř běžné věty bez důvodu;
- zachovat českou diakritiku;
- nepoužívat strojově působící doslovné překlady;
- u dlouhých dokumentů držet stejný styl od začátku do konce;
- názvy sekcí, vysvětlení a komentáře v generovaných knowledge notes mají být česky, pokud uživatel neurčí jinak;
- code blocks, CLI příkazy, JSON, SQL, TypeScript, Python a další zdrojový kód zůstávají ve své přirozené syntaxi.

###### Czech system profile

Každý model dostane krátký pevný jazykový profil, ne obří opakovaný prompt.

Příklad pravidel:

```text
Odpovídej přirozenou moderní češtinou.
Nepřekládej názvy API, knihoven, funkcí ani kód.
Vyhýbej se doslovným anglickým konstrukcím.
Technické termíny používej tak, jak je běžně používají čeští vývojáři.
Pokud český překlad působí nepřirozeně, ponech anglický odborný termín.
Drž terminologii konzistentní v celé odpovědi.
```

Profil bude verzovaný, například:

`cz-profile-v1`

aby bylo možné změny stylu měřit v benchmarku.

###### Few-shot Czech examples

Do orchestrace přidat malou sadu kvalitních českých ukázek.

Ne dlouhé celé konverzace, ale několik krátkých referencí pro:

- běžnou technickou odpověď;
- debugging;
- vysvětlení architektury;
- cybersecurity;
- Knowledge Note;
- code review;
- stručnou odpověď;
- dlouhou odbornou odpověď.

Few-shot sada má učit hlavně:

- slovosled;
- přirozené skloňování;
- správné používání odborných termínů;
- konzistentní tykání;
- českou interpunkci;
- práci s anglickými názvy uvnitř české věty.

Few-shot data budou lokální součást projektu a nesmí obsahovat citlivá uživatelská data.

###### Terminology memory

Přidat lokální slovník preferované terminologie.

Příklad:

```text
commit → commit
branch → větev / branch podle kontextu
pull request → pull request / PR
runtime → runtime
knowledge note → knowledge note
vault → vault
endpoint → endpoint
renderer → renderer
backend → backend
frontend → frontend
deployment → nasazení / deployment podle kontextu
```

Nejde o mechanický překladač. Slovník má zabránit tomu, aby jeden model psal "vykreslovač", druhý "renderer" a třetí "renderovací proces" pro stejný pojem.

Terminology memory bude možné rozšířit podle konkrétního projektu nebo oboru.

###### Czech verifier

Po odpovědi lze spustit lehkou deterministickou kontrolu bez dalšího LLM:

- poměr českých a anglických slov;
- přítomnost diakritiky;
- neočekávané změny jazyka;
- duplicity vět;
- rozbité Unicode znaky;
- podezřelé doslovné překlady z interní blacklist/heuristic sady;
- konzistence vybraných termínů;
- zda nebyl přeložen kód nebo identifikátory.

Verifier vrátí například:

```text
language: cs
czechRatio: 0.91
mixedLanguage: false
terminologyConsistency: pass
unicode: pass
rewriteNeeded: false
```

Tento verifier nemá rozhodovat o faktické správnosti. Kontroluje pouze jazykovou kvalitu a formát.

###### Czech rewrite pass

Pokud odpověď neprojde jazykovým thresholdem, nespouštět celý reasoning znovu.

Použít levnější rewrite krok:

```text
původní obsah
  ↓
"zachovej význam, uprav pouze češtinu"
  ↓
Czech rewrite model
```

Rewrite pass nesmí:

- měnit fakta;
- měnit čísla;
- přidávat nové závěry;
- měnit kód;
- měnit JSON;
- měnit příkazy;
- měnit URL;
- měnit wiki link targets;
- měnit note IDs.

Pro první verzi může Czech rewrite dělat Synthia 7B, pokud benchmark potvrdí, že v češtině podává konzistentní výsledky.

Pokud se ukáže, že specializovaný model Máši generuje lepší odborný obsah, ale horší češtinu, pipeline může vypadat:

```text
masa-cyber
  ↓
odborný obsah
  ↓
Synthia 7B
  ↓
Czech language polish
  ↓
deterministický verifier
```

U heavyweight úlohy:

```text
Nous-Hermes
  ↓
reasoning / návrh
  ↓
Synthia
  ↓
česká finalizace
  ↓
verifier
```

Tím oddělíme "inteligenci úlohy" od "kvality českého výstupu".

###### Czech benchmark

Do model benchmark suite přidat samostatné české skóre.

Testovací sada minimálně:

1. běžná otázka v češtině;
2. technické vysvětlení;
3. debugging;
4. architektura;
5. cybersecurity;
6. dlouhý Markdown dokument;
7. překlad odborného anglického konceptu do přirozené češtiny;
8. odpověď s velkým množstvím anglických API názvů;
9. čeština s code blocks;
10. follow-up konverzace alespoň 5 kol;
11. oprava gramaticky špatného českého vstupu bez změny významu;
12. terminologická konzistence napříč více odpověďmi.

Měřit:

- Czech fluency;
- grammar;
- naturalness;
- terminology consistency;
- instruction following;
- accidental English leakage;
- preservation of code/identifiers;
- long-form consistency.

Výsledek uložit do capability profilu modelu:

```text
czechFluency
czechTechnical
czechLongForm
czechTerminology
czechConsistency
```

Automatický router nesmí preferovat model pro český long-form výstup pouze podle reasoning skóre. Musí zohlednit i český jazykový profil.

###### User language preference

Do lokálního profilu Ethical World uložit:

```text
preferredLanguage: cs
technicalTerms: mixed
tone: natural
codeComments: cs
```

Uživatel musí mít možnost profil změnit.

Language preference nesmí být natvrdo součástí modelu; patří do orchestrace, takže stejný model může odpovídat česky, anglicky nebo jiným jazykem podle workspace/user profilu.

###### Dlouhodobý cíl

Nechceme fine-tunovat model jen proto, že občas udělá špatný český slovosled.

Pořadí řešení:

1. dobrý system profile;
2. terminology memory;
3. few-shot příklady;
4. benchmark;
5. Czech verifier;
6. rewrite pass;
7. teprve pokud to nestačí, zvážit LoRA / fine-tuning nad kvalitním českým datasetem.

Fine-tuning má smysl až tehdy, když benchmark prokáže opakující se problém, který promptování a orchestrace neumí odstranit.

##### Hardware-aware router

Před povolením heavyweight modelu přidat hardware probe:

- dostupná RAM;
- dostupná VRAM;
- typ GPU;
- backend/runtime;
- aktuálně načtený model;
- volitelně naměřené tokens/s.

Router podle toho sestaví capability profil a nesmí nabídnout lokální Mixtral konfiguraci, která by pravděpodobně vedla k extrémnímu swapování nebo nepoužitelnému UX.

##### Benchmark před aktivací

Každý model musí projít stejnou sadou testů:

1. krátká běžná odpověď;
2. česká technická odpověď;
3. coding;
4. debugging;
5. dlouhá Knowledge Note;
6. přesný Markdown format;
7. multi-note generation;
8. follow-up editace;
9. wiki-link discipline;
10. hallucination test nad vault indexem;
11. cybersecurity vysvětlení;
12. odmítnutí / bezpečný převod destruktivní operace;
13. JSON / `<ethical-note>` protocol compliance;
14. time-to-first-token;
15. tokens/s;
16. peak RAM;
17. peak VRAM.

Výsledek nebude jen jedno "lepší/horší" skóre. Každý model dostane capability profil, například:

```text
planning       8/10
knowledge      9/10
coding         6/10
cyber          7/10
reasoning      6/10
speed          9/10
memory         9/10
protocol       8/10
```

Hodnoty budou doplněné až po reálném benchmarku; výše uvedené čísla jsou pouze příklad formátu a nesmí být použité jako skutečné výsledky.

##### Implementační kroky

1. vytvořit obecný `ModelProfile` kontrakt;
2. oddělit model od provideru;
3. umožnit více lokálních OpenAI-compatible/Ollama model endpoints;
4. přidat capability tags;
5. přidat hardware probe;
6. vytvořit deterministic task router;
7. doplnit fallback chain;
8. přidat timeout a circuit breaker na každý model;
9. zabránit tomu, aby chyba heavyweight modelu shodila celou Mášu;
10. přidat per-model telemetry pouze lokálně:
    - latency;
    - TTFT;
    - tokens/s;
    - success/failure;
11. přidat benchmark suite;
12. až po benchmarku zapnout automatické routing decisions.

Cíl AI Boosteru:

```text
ne jeden obří model na všechno

ale

rychlý router
  ↓
správný specialista
  ↓
deterministická kontrola
  ↓
uživatelské schválení
```

To má zlepšit kvalitu Máši bez toho, aby se běžné úlohy zpomalily kvůli permanentnímu používání největšího dostupného modelu.

### 2. Zlepšit Mášin workflow uvnitř Ethical World

- jasně rozlišit:
  - odpověď;
  - plánování;
  - práce;
  - čekání na approval;
  - zápis;
  - dokončeno;
- follow-up quest musí automaticky chápat referenty typu:
  - „ty tři“;
  - „do předchozí poznámky“;
  - „propoj je“;
  - „doplň všude“;
- zobrazit plán před dlouhým agent taskem;
- po schválení více actions nabídnout:
  - `Použít vše`;
  - jednotlivé approval;
- po provedení akce zobrazit výsledek a přímý odkaz na změněnou note;
- při multi-note úkolu zobrazit progress per note;
- napojit graph linking jako explicitní krok orchestrace;
- zvážit agent task history, aby bylo vidět, co Máša skutečně provedla.

### 3. Minimalizovat / zavřít / znovu otevřít Máša chat

AI dock musí mít normální desktop window UX:

- minimalizovat do malé bubliny / chipu;
- zavřít panel bez ztráty chat session;
- kdykoliv ho znovu otevřít z activity railu;
- zachovat historii po zavření;
- možnost úplně AI panel vypnout;
- případně resize;
- volitelně drag position podobně jako Carrot;
- vizuálně odlišit:
  - hidden;
  - minimized;
  - open;
  - working in background.

### 4. Windows installer / icon pipeline – hotovo před dnešním scope

SVG brand mark převést na produkční Windows icon pipeline.

Požadovaný výsledek:

- vytvořit master icon exporty;
- `.ico` s více velikostmi:
  - 16×16;
  - 24×24;
  - 32×32;
  - 48×48;
  - 64×64;
  - 128×128;
  - 256×256;
- nastavit icon v Electron Packager;
- nastavit Squirrel `setupIcon`;
- nastavit shortcut icon;
- nastavit taskbar/window icon;
- zachovat AppUserModelID;
- ověřit Start Menu;
- ověřit Desktop shortcut;
- ověřit Windows Explorer;
- ověřit taskbar;
- znovu vytvořit standalone installer.

Cíl: po instalaci už nesmí Ethical World na PC používat generickou Electron ikonu.

### 5. Installer / packaging – hotovo před dnešním scope

- izolovat důvod posledního `LASTEXITCODE = 1`;
- samostatně ověřit:
  - Squirrel maker;
  - ZIP maker;
- vrátit celý:
  `npm run desktop:make:standalone`
  na exit code 0;
- smoke test čisté instalace;
- ověřit auto-start backendu z nainstalované aplikace;
- ověřit shortcut + novou ikonku.

### 6. Další questy

Nechat prostor na nový návrh workflow/funkcí po zítřejší první kontrole.

Možní kandidáti:

- JSON Canvas workspace;
- Defuddle URL import;
- Knap templates;
- contribution exception + CLA;
- AI task history;
- Carrot retention/export;
- graph clustering;
- semantic embeddings až později, pokud budou dávat smysl výkonově.

---

## Konec dne

Dnešní stav je výrazně dál než původní browser prototype:

```text
Windows EXE
  ↓
vlastní standalone backend
  ↓
lokální Máša
  ↓
ASSIST / approvals
  ↓
Markdown Knowledge Notes
  ↓
wiki + related graph
  ↓
Carrot signed history
  ↓
connectors
  ↓
source-available Rabbithollow product
```

Největší zítřejší téma není přidat další hromadu funkcí, ale zlepšit pocit z práce s Mášou: rychlost, orchestrace, průběžná odezva a skutečně agentické workflow uvnitř Ethical World.


## Dokončovací pass 2026-10-04

Dnešní jediný implementační balík byl zaměřený na dotažení existujících funkcí, nikoli na další feature creep.

### Mermaid je skutečně renderovaný

- přidán lokální `mermaid` runtime;
- `EditorPane` rozpozná fenced `mermaid` block v Markdown preview;
- runtime se načítá lazy až při diagramu;
- Mermaid běží s `securityLevel: strict`;
- limit 50 000 znaků a 500 edges;
- neplatná syntaxe nesestřelí preview, zobrazí fallback se source;
- Máša dostala přesnější instrukci generovat validní fenced Mermaid bez click callbacků, HTML labelů a init direktiv;
- přidány deterministické testy detekce/normalizace Mermaid bloků.

### Carrot integrity dotažena

- před důvěrou v podpis se znovu počítá snapshot hash z reálného `title + folder + content`;
- znovu se počítá commit hash;
- lokální historie kontroluje `parentId` a `parentCommitHash` proti skutečnému parent commitu;
- ruční změna obsahu se zachovaným starým hashem už musí skončit jako neplatná;
- přidány tamper testy.

### Máša dock dotažen

- po prvním otevření zůstává AiPanel mounted;
- schování přes Ctrl+J, topbar nebo activity rail už nemaže chat session;
- skrytý panel dál může dokončit právě běžící request;
- titlebar má funkční minimalizaci/skrytí;
- batch návrhy mají `Použít vše`.

### CI

- workflow se znovu spouští automaticky na push a pull request pro `main` a `dev/first-runnable`;
- manual `workflow_dispatch` zůstal;
- oba aktuální GitHub Actions joby stále končí před prvním krokem a GitHub neposkytuje žádné step/log output;
- to je oddělený runner/account-level blocker, ne zaznamenané selhání `npm test`, `npm run build` nebo Python compile kroku;
- z workflow byl odstraněn npm cache požadavek, protože repo zatím nemá package lock.

### Dokumentace srovnána s realitou

Aktualizované:

- `README.md`;
- `ROADMAP.md`;
- `STRUCTURE.md`;
- `SECURITY.md`;
- `AI.md`;
- `CARROT.md`.

ROADMAP už nevede Graph, Electron shell ani základní agent actions jako neimplementované.

### Windows installer

Windows installer / standalone packaging byl dokončený už před dnešním scope. Dnes jsme na installeru nic neměnili.

### 2026-10-05

**Day off.** Žádné nové implementační questy na zítřek. AI Booster/orchestrace zůstává zdokumentovaný backlog pro další pracovní den.


## Deep audit 2026-10-04

Po dokončení dnešních questů proběhl samostatný bug + cybersecurity audit.

Výsledek je uložený v `AUDIT.md`.

Během auditu byly rovnou opravené:

- Electron top-level navigation trust boundary;
- IPC sender validation;
- unsafe external URL protocols;
- Carrot snapshot/commit/parent integrity;
- server-side session revocation při logoutu;
- revokace ostatních sessions po změně hesla;
- Notion OAuth callback HTML escaping + CSP;
- základní Electron security policy test suite.

Repo nyní obsahuje 44 explicitních test cases, ale GitHub Actions stále končí před prvním runner stepem, takže dnešní HEAD nelze označit jako CI-green pouze podle Actions.

Nejvyšší zbývající priority:

1. backend runtime identity na portu 8787;
2. owner bootstrap one-time capability;
3. packaged renderer E2E a bezpečné vyřešení file-origin/CORS;
4. autosave flush při rychlém switchi;
5. symlink/junction-safe Markdown writer.

Zítřek zůstává **day off**; audit je backlog pro další pracovní den, ne další dnešní feature sprint.


### Audit addendum — Carrot signer trust

Druhý průchod auditem odhalil, že Carrot už kontroluje snapshot hash, commit hash, parent chain a Ed25519 podpis, ale podpis je stále ověřovaný proti public key uloženému v samotném commitu.

To je dobrá integrita, ale ještě ne plná autenticita signer identity.

Do `AUDIT.md` proto přibyl P1 backlog:

- trusted signer registry v Electron main;
- device public key jako lokální trust anchor;
- reject neznámého nebo podvrženého `keyId/publicKey`;
- test forged signer key;
- budoucí key rotation/revocation model.


### Audit addendum — auth abuse controls

Deep audit doplnil ještě dvě backend priority:

- login potřebuje lokální rate-limit/backoff, protože scrypt může být zneužit i k CPU DoS;
- expired sessions sice už nejsou platné, ale SQLite rows je vhodné průběžně čistit a omezit počet sessions per user/device.

Obě věci jsou přidané do navrženého FastAPI security test balíku.

## 2026-10-06 — opravy hlubokého auditu

Scope: stabilizace existujícího MVP a bezpečnostních hranic. Ověření proběhlo lokálně; na GitHub Actions nečekáme. Private repo nevyžaduje premium plán pro tyto opravy.

### Dokončené opravy

- Build: opravený typ graph links; Vitest a Node testy mají oddělené discovery. Přidán npm lockfile, Python runtime lock a `verify:full`. Instalace používají `npm ci` a uzamčené backend dependencies; aktualizované závislosti a cílené overrides odstraňují nalezené advisories.
- Persistence: změny poznámky se okamžitě řadí do serializované write queue; switch poznámky je neruší. Editor zobrazuje průběh a chybu uložení. Load failure neotevře prázdný zapisovatelný vault. Import/rename ukládají workspace v jedné IndexedDB transakci. Agentní batch pracuje s aktuálními refs, takže note vidí složku vytvořenou předchozí akcí.
- Runtime: desktop spouští vlastní backend s náhodnou capability a challenge proof; cizí proces na 8787 se nepřebírá. Renderer používá omezené IPC, web dev/preview ověřenou same-origin Vite proxy. Jedna desktop instance. Owner bootstrap pouze jednou za runtime; frontend bootstrap je single-flight i ve StrictMode.
- Auth/API: omezení auth pokusů, scrypt mimo event loop, úklid expired sessions a limit sessions/user. Limity body/response a souběhu chatu. Provider URL/DNS policy, ověřená IP, zákaz redirectů a implicitních env proxy. OAuth states mají expiraci a omezený počet.
- Carrot: atomicky uložená OS-encrypted signer identity, single-flight key creation, serializované podpisy, enrolled key verification a checkpoint potvrzený až po zápisu historie. Neznámý signer a rollback nejsou validní historie; po selhání potvrzení lze dokončit checkpoint z uloženého parent commitu.
- Konektory: case-sensitive GitHub source paths, importovaný baseline a odmítnutí konfliktů. Root Markdown export nemá umělý Untitled adresář. Lokální writer kontroluje symlinky/junctions, preflight konfliktů, serializaci a zálohy. GitHub kontroluje blob SHA a branch posouvá bez force. Notion porovnává aktuální obsah před zápisem. Výchozí export je omezený na daný source; celý vault vyžaduje explicitní volbu a potvrzení seznamu cest.
- UI/web: omezené AI history/context payloady, CSP, vzdálené obrázky až po kliknutí, no-referrer. Graph parsuje vlastnosti poznámky jednou. Service worker má versioned cache všech build assets, nenechává API v cache a neposílá HTML místo chybějícího JS. Manifest a relativní asset paths.
- Private releases: veřejný Electron updater je standardně vypnutý; vědomý opt-in pouze přes `ETHICAL_WORLD_PUBLIC_UPDATES=1`. Private instalátor distribuce zůstává manuální.

### Lokální validace

- Čisté `npm ci --ignore-scripts` a `npm run verify`: 46 frontend testů + 9 Electron/main helper testů, TypeScript a produkční Vite build prošly.
- Python 3.12: 11 backend security testů prošlo. Testy používají izolovaná dočasná data a stub providery.
- Live HTTP smoke: skutečné Vite → FastAPI → loopback provider volání, owner bootstrap/session/me/logout, druhý bootstrap 409, odmítnutí cross-origin proxy a direct API bez capability. Prošlo; provider je fixture, nikoli skutečný placený model.
- npm audit: 0 známých vulnerabilities. pip-audit v ověřeném prostředí: žádná známá vulnerability. Jde o stav databází advisory v době kontroly.
- `git diff --check` prošel. CI workflow upravený pro reproducible install a backend testy; vzdálené CI výsledky nejsou podmínkou tohoto předání.

### Otevřené položky / hranice výsledku

1. Před release ověřit Windows packaged Electron, safeStorage, junctions, instalátor a Notion OAuth s reálným účtem. Linux helper testy nejsou Windows/Electron E2E. Playwright browser download v tomto prostředí vracel poškozený archiv; skutečný browser E2E nebyl proveden. UI integrační testy jsou jsdom + fake IndexedDB.
2. Účty používají společný device-local vault. Oddělené a šifrované vaulty, OS key store pro Notion klíč a úplný logout lock jsou budoucí změna bezpečnostního modelu; UI to nyní výslovně uvádí.
3. Notion API nemá atomický compare-and-swap: vzdálená změna mezi kontrolou a PATCH je stále možná. Lokální filesystem preflight není kernel-level ochrana před aktivním procesem měnícím adresáře; více souborů nemá atomickou batch transakci. Zachovávané backups vyžadují případné ruční obnovení.
4. Graph má rychlejší předzpracování, ale stále párovou O(n²) část. Worker/inverted index a velké Mermaid chunks zůstávají výkonový backlog. Chat používá omezené posuvné okno bez sumarizace starší historie.
5. Write queue chrání rychlé edit/switch; násilné ukončení procesu před dokončením IndexedDB zápisu není garantované flush. Běžné manuální workspace operace potřebují další fault-injection ověření rollbacků. Runtime capability nechrání před kompromitovaným OS uživatelem.
6. Carrot rotation/revocation a přenos důvěry mezi zařízeními nejsou implementované. Bootstrap po restartu je vědomé lokální device-owner chování, nikoli vzdálená autentizace identity.

Původní `AUDIT.md` zůstává historický nález; tento zápis popisuje aktuální remediation a přiznaný backlog. Žádný Windows installer ani release nebyl tímto předáním publikován.

## 2026-10-06 — Máša: deklarace versus skutečné schopnosti

Požadavek: Máša musí provádět deklarované operace, ne pouze slibovat jejich provedení.

- Implementované doménové nástroje pro rename/move/link/task vedle existujícího create/update/folder/open. Zachovávají původní obsah, kontrolují cílové IDs, existující složky a jednoznačné wiki názvy.
- Retrieval nyní řadí relevantní starší poznámky podle dotazu a přidává wiki návaznosti. readNote je lookup přesného ID. Embeddings/hybrid RAG zůstává explicitně budoucí vrstva, nikoli tvrzení o současné implementaci.
- ASSIST má rozbalitelný náhled původního i výsledného obsahu/cesty. Snapshot + updatedAt chrání čekající návrh před přepsáním mezitím změněné poznámky. Zápisy používají serializovanou queue; pozdější uživatelské úpravy mají přednost.
- AGENT dovoluje pouze nové poznámky ve složce explicitně zvolené pro session. Bez grantu se vše potvrzuje. Existující poznámky/struktura se mění po potvrzení i v AGENT. READ nemůže akce použít; přepnutí režimu ruší čekající návrhy/grant. Apply je serializovaný a nelze ho spustit souběžně s generováním.
- DB migrace v4 přidává agentAudit se zahájením, výsledkem a chybou. Export JSON v nastavení. Zápis auditu předchází provedení; selhání výsledného audit zápisu neoznačí již provedenou změnu za neprovedenou.
- Backend i frontend rozlišují úplný a zkrácený kontext. Neúplně přečtená poznámka nesmí být nahrazena modelovým dokumentem. Envelope přes limit se odmítá, nikoli tiše zkracuje. Carrot failure po úspěšném uložení hlásí vlastní chybu místo nabídnutí opakovaného vytvoření stejné poznámky.
- AI.md má tabulku skutečného stavu: shrnutí/report/code review jsou generování připojeným LLM nad omezeným kontextem. Nejde o spuštění skriptů, skeny nebo garantovanou faktickou správnost. Trvalá sumarizovaná paměť, embeddings a neomezená autonomie nejsou implementované.

Validace: přidané testy retrieval, rename/move/link/task, stale/ambiguous targets, parser baseline, skutečný App batch až do IndexedDB, UI ASSIST preview/approval/audit, READ rejection, AGENT scope a partial-context overwrite rejection. Backend testuje AGENT prompt i completeNoteIds. Windows packaged/browser E2E nadále otevřené dle předchozího zápisu; na CI/CD nečekáme.

Výsledek lokálního ověření tohoto bloku: 54 frontend testů, 9 Electron helper testů a 12 backend testů (75 celkem), TypeScript + Vite produkční build a live Vite/API/provider fixture smoke. Neplatný modelový návrh hlásí chybu místo tichého tvrzení o provedení.

## 2026-10-06 — upgrade nainstalovaného EXE

Lokální upgrade nainstalované Windows aplikace ze zdrojové větve `dev/first-runnable`.

- Package version 0.1.1 v package.json i npm lockfile, navazující na původní 0.1.0. Bez automatického tagu, publikace Release nebo CI čekání.
- Přidán `npm run desktop:update`: Windows-only lokální install/verify, nové sestavení bundled backendu a Squirrel installeru, kontrola čerstvého výstupu, upgrade a launch přes shortcut. Před upgradem je nutné aplikaci zavřít; skript při otevřené aplikaci odmítne pokračovat. UserData nemaže.
- Installer verification nyní kontroluje exit code Setup.exe, očekávanou ProductVersion, bundled backend a cestu skutečně spuštěného EXE; samotný starý shortcut už nestačí jako důkaz upgradu.
- DESKTOP.md rozlišuje lokální upgrade private repozitáře od automatického GitHub updateru. Veřejný update service zůstává vypnutý pro private releases.
- Ověření zde: konzistence verze/lockfile, npm testy a Node helper testy. Windows make/Setup/upgrade vyžaduje samostatný Windows retest. Skript vyžaduje funkční Windows packaging toolchain a Python, již použité při předchozím installeru.

## 2026-10-06 — backend tests blokují Windows upgrade

Backend gate v `desktop:update` skončil s `FAILED (errors=6)`. Dostupný výpis neobsahuje první traceback; příčinu všech šesti chyb nelze zpětně potvrdit.

- Kontrola odhalila prokazatelný leak SQLite spojení: původní `with _connect()` řídil transakci, ale nezavíral Connection. Windows může následně odmítnout odstranění dočasné databáze/WAL; Linux dovoluje unlink otevřeného souboru, takže původní test suite problém skrývala.
- `_connect` nyní vlastní celý lifecycle: PRAGMA konfigurace, transakční commit/rollback a `close()` ve finally i při chybě konfigurace. Žádný test ani bezpečnostní gate se nepřeskakuje.
- Tři regression testy drží reference na Connection a ověřují zavření bez spoléhání na garbage collection. Před opravou všechny tři selhaly; po opravě procházejí. Ověřen také commit a rollback.
- Nový `python -m server.test_runner` ukládá úplný UTF-8 výpis testů a tracebacky do `out/diagnostics/backend-tests.log`, včetně Python/platform/SQLite verzí. Nepíše obsah prostředí ani reálné tokeny. ASCII console encoding nesmí zamaskovat původní chybu; to ověřuje fault-path test.
- `desktop:update` a npm test:backend používají runner; při selhání updater odkáže na log a zastaví před instalací. Dočasný import fixture se explicitně uklízí při ukončení.
- Výsledek lokální validace: 17 backend testů prošlo na Python 3.12/Linux, včetně původních security testů. Windows retest a přesná diagnóza původních šesti chyb zůstávají otevřené; nalezený leak není potvrzením chybějícího tracebacku.

## 2026-10-06 — EBUSY při packagingu a neplatný desktop shortcut

Windows packaging skončil s EBUSY při rmdir `out/Ethical World-win32-x64/resources/backend`, následně dialog Windows o chybějícím cílovém EthicalWorld.exe. Konkrétní držitel zámku nebyl identifikovaný; chyba potvrzuje uzamčený předchozí výstup. Zástupce sám o sobě neznamená ztrátu vault dat.

- Updater nyní používá pro každý build vlastní `out/updates/<guid>` přes Forge outDir. Starý výstup se nemaže ani znovu nepoužívá. InstallerPath se předává explicitně, takže upgrade nevybere jiný starý Setup.exe podle globálního timestampu.
- Forge ignoruje out, .venv, resources kopii, .git a .env při balení app obsahu. Backend se přidává přes extraResource. Staré buildy ani runtime secrets se nesmí rekurzivně zabalit do nové aplikace.
- Před lokálním buildem updater ukončí pouze zbylé procesy EthicalWorldBackend, jejichž executable path leží pod out/resources tohoto projektu nebo známou Squirrel instalací ethical_world. Otevřená hlavní aplikace stále blokuje update. Žádné obecné taskkill podle názvu Python/Electron a žádné mazání uživatelských dat.
- Nový backend dostává vlastní stdin pipe. EOF při zavření nebo pádu Electron parenta spustí graceful uvicorn shutdown. Electron při quit čeká na backend; Windows fallback cílí pouze PID vlastního ChildProcess a jeho potomky. To řeší i onefile parent/child lifecycle, kde původní kill samotného bootloader parenta mohl ponechat child.
- Installer test ověří instalaci v LocalAppData/ethical_world, verzi a bundled backend a opraví canonical desktop shortcut i rozpoznané existující EXE shortcuty na stabilní Update.exe --processStart EthicalWorld.exe. Zástupce tedy neodkazuje na cestu jednorázového packaging výstupu nebo starého app-version adresáře.
- Validace: 54 frontend testů, 13 Electron/helper testů, 20 backend testů (87 celkem). Nové testy ověřují výstupní izolaci/ignore policy, graceful pipe close, pouze scoped PID fallback, již ukončený proces a skutečný Python subprocess health → EOF → exit 0. Node syntax a git diff --check prošly.
- Windows Squirrel make/COM shortcuts/bootloader upgrade zde nelze provést: finální ověření vyžaduje Windows retest. Legacy backend při nuceném ukončení může zanechat PyInstaller temp cache; updater ji plošně nemaže. Staré out buildy zůstávají pro ruční úklid po úspěšném upgradu.

## 2026-10-06 — NullArrayIndex před spuštěním instalátoru

- Potvrzená příčina: `Get-EthicalWorldShortcuts` ukládal seznam do `$matches`, ale skalární `-match` přepisuje automatickou `$Matches` regex hashtable. PowerShell nerozlišuje velikost písmen. Funkce vracela tabulku namísto shortcut recordů a `$beforeMap[$item.Path]` indexoval null ještě před `[2/4] Running installer`.
- Kolekce přejmenovaná na `$foundShortcuts`; discovery umožňuje předat shell a adresáře pro izolované testování skutečné funkce. Normální instalace dál čte Desktop/Programs přes WScript.Shell. V build-backend byl obdobně odstraněn zápis do automatické `$args` ve prospěch `$buildArguments`.
- Přidaný regresní test spouští skutečný PowerShell a načítá pouze discovery funkci přes AST, bez spuštění instalátoru. Ověřuje prázdnou plochu, jeden/více shortcutů, rozpoznání podle targetu/arguments, duplicitní lokace, nečitelný a nesouvisející link a použití výsledků jako snapshot keys. Parsuje všechny desktop PS skripty a hlídá zápisy do vybraných automatických proměnných. Node runner je součástí `test:electron`; bez dostupného PowerShellu test explicitně přeskočí.
- DESKTOP.md obsahuje dokončení instalace z již hotového `out/updates` balíčku. Tato oprava mění skripty/testy/dokumentaci; právě dokončený aplikační build není nutné opakovat. Nové změny aplikačního kódu by vyžadovaly nové sestavení.
- Validace: před přejmenováním regresní test selhal na chybějící `Path` ve vrácené hashtable; po opravě prošel v PowerShell 7.4.7 na Linuxu. Celá sada 14 Electron/helper testů prošla včetně PowerShell testu bez skipu; `git diff --check` prošel. Reálné Windows COM, Windows PowerShell 5.1 a Squirrel instalace/spuštění nadále vyžadují ověření na Windows; úspěšný upgrade zatím netvrdíme. Na CI/CD nečekáme.

## 2026-10-06 — Windows launcher s automatickým Git upgradem

- Přidaný samostatný WinForms launcher a Node worker. Jednorázový `desktop:launcher:install` vytvoří ikonu Ethical World Launcher na ploše i ve Start Menu a uloží stabilní skripty/config/ikonu do LocalAppData/EthicalWorldLauncher. Konzole zůstává skrytá; okno ukazuje průběh a otevírá log.
- Každý nový start kontroluje origin tohoto repozitáře, přesnou větev a čistý working tree; fetch/merge používá pouze fast-forward. Lokální změny, vlastní nebo rozcházející se historie a jiná větev blokují update. Není použitý reset, clean, stash ani změna větve. Git přístup používá existující Credential Manager/SSH agent, token aplikačního konektoru se launcheru nepředává.
- Potvrzený Git commit + dostupné EXE/backend znamená rychlé spuštění bez nového buildu. Nový commit provede existující lokální verify/backend gate, standalone make a instalaci. První spuštění launcheru sestaví ověřenou verzi; stará instalace nemá commit receipt. Běžící aplikace se pouze fokusuje a update počká na další start po zavření. Mutex a worker lock brání dvojímu souběžnému updatu.
- Verze desktop balíčku vychází z major/minor zdrojového package.json a patch + počet commitů plné historie. Squirrel tak dostane vyšší verzi i pro další commit se stejnou source verzí. Forge readPackageJson hook a Packager appVersion upravují maker metadata a staging kopii; zdrojový package.json/lockfile zůstávají nedotčené. Shallow historie, vyšší už nainstalovaná verze a Windows version overflow jsou odmítnuté.
- Updater podporuje NoLaunch, ExpectedCommit, PackageVersion a instalační receipt. Před instalací znovu kontroluje commit a working tree. Launcher potvrzení uloží až po validaci verze/receipt a otevření aplikačního okna. Chybný build, receipt nebo start neposune installed commit. Offline Git a neúspěšný build otevírají předchozí dostupné EXE; při poškozené instalaci je fallback omezený dostupností starého EXE, bez slibu transakčního rollbacku Squirrel.
- Generovaný resources/backend je ignorovaný v Gitu. Přímý zástupce Ethical World zůstává samostatný; instalační smoke vybírá pouze skutečný app/Update.exe shortcut, aby nezahájil další launcher update. Stable launcher se po úspěšném upgradu obnoví ze zdrojů.

## 2026-10-06 — GitHub Device OAuth a token fallback

- Ověřená odpověď GitHub `/login/device/code` pro zabudovaný Client ID: HTTP 400, device_flow_disabled. Původní obecná výjimka zakrývala vypnutý Device Flow v registraci GitHub aplikace. Tento stav není možné zapnout změnou repozitáře; konektor nyní zobrazuje konkrétní příčinu a alternativu.
- Přidané Připojit tokenem přes samostatné modal Electron okno s CSP, sandboxem a úzkým IPC ověřujícím sender i hlavní frame. Token se ověří přes GitHub /user a uloží do existující OS secure storage; hlavní workspace dostává pouze login/stav. Zrušený nebo neplatný token nepřepíše uložené připojení.
- Device flow má timeout, odmítá redirecty a neplatné code/expiry/verification URL odpovědi. Polling respektuje interval/slow_down; chyby se vracejí jako strukturovaný výsledek bez technického IPC prefixu. Token přihlášení funguje i bez nakonfigurovaného OAuth Client ID.
- DESKTOP.md popisuje jednorázovou aktivaci launcheru, private Git přístup, offline/chybové chování, per-commit verze a obě možnosti GitHub přihlášení. Guide má odpovídající CZ/EN formulaci.

Validace obou bloků: 57 frontend testů, 29 desktop/helper testů a 20 backend testů (106 celkem), TypeScript + produkční Vite build a git diff --check. Launcher testy používají skutečné dočasné Git repozitáře a ověřují fast-forward, opakovaný start, zachování lokálních změn/historie, offline/build failure, chybný receipt, launch failure, worker lock a verzování přes skutečné Forge/Packager interní zpracování. PowerShell 7.4.7 testuje discovery/výběr shortcutu a parsuje všechny PS skripty; frontend testuje hlášku Device Flow i token připojení bez token pole v hlavním workspace. GitHub HTTP 400 byl ověřen živě; token a native prompt scénáře jsou fixture testy. Reálné WinForms, Windows PowerShell 5.1, COM ikony/shortcuts, Squirrel make/upgrade a přihlášení skutečným PAT vyžadují Windows retest. Na CI/CD nečekáme.

## 2026-10-07 — prodleva při Git kontrole a odesílání v Máša chatu

- Projev: launcher zůstává přibližně dvě minuty u kontroly aktualizací; chat hlásí Online, ale text po Enteru ani tlačítku neopustí vstup. Bez runtime logu není potvrzená přesná příčina na konkrétní Windows instalaci.
- Původní launcher spouštěl PowerShell kvůli seznamu procesů a každý Git příkaz měl vlastní 30sekundový timeout. Kontrola procesů nyní používá Windows tasklist s limitem 3 sekund. Lokální kontrola repozitáře, fetch a kontrola historie sdílejí osm sekund a AbortSignal předávaný skutečnému execFile; po timeoutu se nezahájí merge ani build a otevře se dostupná instalace.
- Před fast-forward zápisem se časovač ruší, aby nový limit nepřerušoval změny checkoutu. Build a instalace zůstávají samostatné operace. Origin/větev/čistý tree a zákaz reset/clean/stash se nemění. Okno rozlišuje fáze kontroly a log ukládá jejich dobu, bez Git stderr nebo credential URL.
- Enter i tlačítko používají jeden form submit s hodnotou skutečného textarea. Shift+Enter a potvrzení IME zprávu neposílají. Stavové kontroly modelu jsou informativní; neúspěšný probe už tiše nezablokuje skutečný chat požadavek. Runtime capability a ověřování identity backendu zůstávají povinné.
- Příprava zprávy včetně ID je uvnitř try/catch/finally. Reprodukovaná chyba při generování ID předtím končila unhandled rejection mimo chybovou hlášku. Pro kontexty bez randomUUID je přidané UUID z crypto.getRandomValues, bez Math.random. ID se připravují před React state updatery, aby případná výjimka neunikla z handleru.
- Souběžné odeslání blokuje synchronní ref lock. Neúspěšný požadavek obnoví rozepsanou zprávu a odstraní nevyřízenou user message z historie; opakování ji neposílá dvakrát. Nový text rozepsaný během čekání se nepřepisuje. Chyba má role alert a čekání na odpověď vlastní viditelný stav.
- Přidané regresní scénáře: Enter/tlačítko bez randomUUID, Shift+Enter/IME, chyba před requestem, vyplnění bez change eventu, neúspěšný status probe a přerušený pomalý Git fetch. Transport testy používají skutečný sendAiMessage, desktop gateway helper, challenge proof a HTTP fixture; ověřují oba triggery, jeden request a retry po HTTP 502 bez ztráty draftu nebo duplikace historie. Nové fault-path testy selhaly na původní implementaci.
- DESKTOP.md obsahuje postup spuštění modelového serveru Ollama a odlišuje jej od automatického FastAPI backendu desktopu. Další úkol: spouštění modelového serveru z launcheru bez ručního PowerShellu; zatím není implementované.

Validace: 66 frontend testů, 30 desktop/helper testů a 20 backend testů prošlo (116 celkem), včetně PowerShell 7.4.7 kontroly skriptů (bez skipů). TypeScript + produkční Vite build a git diff --check prošly. Live smoke ověřil desktop gateway → skutečný FastAPI subprocess → loopback Ollama HTTP fixture → odpověď HTTP 200 a ukončení backendu přes parent EOF. Fixture negeneruje odpověď skutečným LLM. Reálný Windows launcher, jeho časování a zadávání do nainstalovaného Electron okna vyžadují retest na Windows; testované slabiny samy nepotvrzují příčinu konkrétní instalace. CI/CD není podmínkou předání.

## Questy na zítra — Máša runtime, výkon a skutečné akce

Stav: původní plán dalšího pracovního bloku; implementace níže doplňuje runtime Ollamy, menší prompty, streaming a benchmark. Kritéria vyžadující skutečné Windows a `masa-cyber` zůstávají otevřená. Priorita: bez ručního spouštění modelového backendu, rychlý běžný chat, spolehlivé změny vaultu a přímo viditelný benchmark.

### 1. Máša si připraví backend a model sama

- Navázat na automatický FastAPI backend desktopu a doplnit spuštění zvoleného modelového serveru Ollama nebo llama-server. Ověřit běžící službu; existující funkční instanci znovu nespouštět.
- Spouštět jen zvolený dostupný model, případně jej předehřát a rozumně držet v paměti. Zachovat explicitní výběr modelu včetně tagu `masa-cyber:latest`, aby automatická detekce nepřepínala na jiný nebo větší model.
- Zobrazit stav spouštění, připravenost, timeout i důvod selhání. Chybějící model řešit srozumitelně; stažení až po potvrzení.
- Řídit jen procesy spuštěné aplikací. Zopakované otevření nesmí vytvářet duplicitní backendy ani ukončovat jinou Ollamu, Python nebo Electron.
- Hotovo až po Windows ověření: zavřený modelový server → launcher → připravená Máša → první odpověď, opakovaný start a obnova po pádu bez ručního PowerShellu.

### 2. Zrychlit každou zprávu a změřit příčinu

- Výchozí problém: `masa-cyber` je pomalá při každé zprávě, nejen při prvním načtení. Aktuální klient přibaluje až 20 poznámek a 40 zpráv historie. Backend přidává až 30 000 znaků poznámkového kontextu a 14 000 znaků vault indexu; i běžná odpověď má limit 2 048 výstupních tokenů. Jde o nalezené zatížení v kódu, nikoli o potvrzený bottleneck konkrétního PC.
- Nejdřív zaznamenat baseline pro krátký chat, navazující dotaz, práci s poznámkou a tvorbu více dokumentů. Rozdělit čekání na načtení modelu, zpracování promptu a generování; ověřit GPU/CPU využití a skutečný název modelu.
- Běžnému chatu přidělit menší rozpočet historie a kontextu, vyhledávat cíleně a neposílat celý nedávný vault na každý dotaz. Stabilní části promptu uspořádat pro opětovné využití kontextu.
- Oddělit stručný chat od tvorby dokumentů; běžná odpověď nemá automaticky generovat dlouhou přednášku. Nastavení délky musí zachovat možnost podrobné odpovědi a úplného dokumentu.
- Přidat průběžné zobrazování odpovědi od prvního tokenu. Neúplné akční bloky se nesmějí provádět během streamu; zápis přijde až po dokončení, validaci a potřebném potvrzení.
- Zachovat ochranu proti přepsání poznámky z částečného kontextu. Zrychlení nesmí zahodit požadované části dokumentu ani obcházet oprávnění.
- Hotovo až po porovnání stejného modelu a stejných úloh před/po na skutečných Windows; zapsat naměřená zlepšení a zbývající hardwarová omezení.

### 3. Markdown a skripty směrovat do poznámek

- Požadavek na vytvoření, doplnění nebo úpravu poznámky převést na konkrétní vault akci. Markdown, Mermaid a požadované skripty patří do výsledného dokumentu; chat má ukázat stručný stav, náhled k potvrzení a výsledek provedení.
- Dotaženě propojit směrování zadání, modelovou odpověď, parser, validaci, oprávnění, zápis a potvrzený výsledek. Volný výpis dokumentu v chatu nesmí být považovaný za splnění úkolu.
- Podporovat více samostatných poznámek, navazující úpravy a přesné cílové IDs. Otevřít výslednou poznámku nebo nabídnout přímý odkaz. Původní obsah a nevyřízené návrhy zachovat při chybě.
- ASSIST před zápisem vyžaduje potvrzení; AGENT automaticky vytváří pouze ve schválené složce, READ nezapisuje. Hlášku „uloženo“ zobrazit až po úspěšném zápisu; chybný či neúplný modelový návrh dostane konkrétní chybu.
- Hotovo až po integračních scénářích: vytvořit poznámku se skriptem → potvrdit → otevřít uložený obsah; doplnit existující poznámku; vytvořit tři dokumenty; odmítnout neplatnou nebo neoprávněnou akci bez ztráty dat.

### 4. Počítadlo tokenů a benchmark přímo v chatu

- U každé odpovědi zobrazit vstupní a výstupní tokeny, součet, celkový čas a rychlost generování v tokenech za sekundu. Doplnit souhrn za konverzaci a aktuální model/provider.
- Počty brát ze skutečných metadat providera. U Ollamy zachovat `prompt_eval_count`, `eval_count`, `load_duration`, `prompt_eval_duration` a `eval_duration`, které současný provider wrapper při vrácení samotného content zahazuje.
- Odděleně zobrazit načítání modelu, zpracování vstupu a generování; čas do prvního tokenu měřit při streamování. Ollama uvádí duration v nanosekundách: správně převádět jednotky a rychlost počítat z eval_count / eval_duration, nikoli z celkového času včetně načítání.
- Případný odhad tokenů před odesláním jasně označit jako odhad. Chybějící metadata zobrazit jako nedostupná; nesmí vzniknout smyšlená nula, NaN ani Infinity. Prompt, obsah poznámek a klíče nelogovat do benchmark metadat.
- Hotovo až po ověření proti skutečným provider metadatům, včetně cold/warm běhu, nulové délky měření, chyby požadavku a providera bez usage statistik.

Reference pro implementaci metrik a lifecycle: [Ollama Chat API](https://docs.ollama.com/api/chat), [Ollama FAQ](https://docs.ollama.com/faq).

Tento zápis doplňuje backlog a kritéria dokončení. Aplikační kód se v tomto bloku nemění; kontrola dokumentace: `git diff --check`.

## 2026-10-07 — Máša: menší prompty, streaming, příprava modelu a benchmark

- Běžný chat, práce s vaultem a dokumenty mají oddělené znakové rozpočty kontextu/indexu/historie a výstupní tokenové limity. Rychlý chat má 768 výstupních tokenů, vyvážený 1 536 a podrobný 3 072; dokumenty zachovávají 6 144. Výslovný požadavek na podrobnost zvýší rychlou volbu. Poslední zadání zůstává celé v rámci limitu 20 000 znaků; delší vstup se odmítne s obnovením draftu, místo tichého useknutí. Starší výřezy mají označení neúplnosti.
- Klient neposílá těla všech nedávných poznámek. Vybírá aktivní poznámku, vyhledané výsledky, souvislosti a poznámky odkazované nedávnou konverzací při navazující práci. Výběr nejvýše 8 těl doplňuje metadata nejvýše 500 poznámek. Index backendu zachovává celé řádky s IDs a cesty složek; nepřerušuje je uprostřed identifikátoru. Rozpočty jsou počty znaků, nikoli tvrzení o skutečné tokenizaci modelu.
- Srovnání stejného syntetického payloadu se starou implementací z předchozího commitu: 20 poznámek po 10 000 znacích, 500 indexových položek a 39 starších zpráv po 1 100 znacích + krátký dotaz. Provider prompt klesl z 89 475 na 8 583 znaků (−90,4 %). Měření dokládá redukci tohoto promptu, nikoli rychlost generování nebo kvalitu na skutečném LLM.
- Ollama chat nově používá NDJSON stream přes FastAPI a ověřenou desktopovou IPC bránu. Text běžné odpovědi se ukazuje průběžně. Start/final/error eventy jsou kontrolované, čtení je omezené velikostí a časem; UTF-8 se dekóduje přes hranice chunků. Finální odpověď se vrací i jako výsledek IPC, takže dokončení nespoléhá jen na pořadí progress callbacků. READ/ASSIST/AGENT a oprávnění trusted rendereru zůstávají zachovaná. OpenAI-compatible dál používá dokončenou JSON odpověď.
- Zastavit přeruší Ollama stream; zavření rendereru nebo aplikace také ruší otevřené streamy. Před dokončením se žádné modelové akce nespouštějí. Chybějící done/final, neplatný nebo neuzavřený blok a tokenový limit neznamenají dokončený návrh. Draft se při chybě/zastavení obnoví bez přepsání nově rozepsaného textu. Platné dokumenty zůstávají v náhledu návrhů; chat má krátké potvrzení. Volný dokument bez platné akce dostane chybu a nepředstírá uložený obsah.
- Metadata odpovědi obsahují skutečné input/output počty, load/prompt/generation časy a rychlost eval_count / eval_duration; nanosekundy se převádějí na milisekundy. Zvlášť se měří první provider token a první viditelný text v chatu. Frontend zobrazuje čas celého požadavku, model/provider odpovědi a souhrn naměřených tokenů konverzace s počtem pokrytých odpovědí. Chybějící údaje jsou pomlčka; bool, záporné, necelé počty, neomezená čísla, NaN a Infinity se nepoužijí. OpenAI usage nedostává smyšlené tok/s. Prompt ani klíče se do metrik nezapisují.
- Po otevření desktopové Máši se připraví lokální Ollama a zvolený již nainstalovaný model. Běžící server se znovu nespouští; případný vlastní `serve` má IPv4 loopback binding, skryté okno a řízení jen svého PID. Souběžné žádosti a alias/latest sdílejí přípravu. Načtení modelu probíhá mimo otevření hlavního okna; timeout, chybějící Ollama/model a retry jsou viditelné. Prázdný generate předehřívá a chat používá keep_alive 15m. Existující cizí server se při zavření aplikace neukončuje.
- Model/provider/Base URL/délka odpovědi se ukládají bez API klíče a bez AGENT grantu. Probe nepřepíná jiný model a pozdní warmup nesmí přepsat novou ruční volbu. Masa alias/latest se sjednocuje. Provider localhost používá ověřenou IPv4 adresu, pokud je dostupná, aby IPv6 pořadí DNS nerozbilo připojení k vlastnímu loopback listeneru. SSRF kontroly, pinning IP a zákaz redirectů se nemění.
- Úplnost předaného obsahu nadále řídí oprávnění k nahrazení poznámky. Ollama dostává truncate=false/shift=false, aby podporovaná verze raději odmítla překročení kontextu než potichu vynechala historii. Žádné vynucování GPU, změny num_ctx, vypnutí modelového reasoning nebo automatické stahování modelů. Podporu flags i skutečnou kapacitu instalované Ollamy je nutné ověřit; znakový limit toto sám nezaručí. Automatický start vlastního portu/llama-serveru není součástí tohoto bloku.

Validace: 79 frontend testů, 35 desktop/helper testů a 33 backend testů prošlo (147 celkem, bez skipů), včetně PowerShell 7.4.7 kontroly skriptů. TypeScript + produkční Vite build, syntaxe Electron main/preload/model runtime a git diff --check prošly. Testy ověřují průběžnou odpověď před final, cancel a obnovení draftu, dropped stream, UTF-8 hranice, autentizaci gateway, zachování modelu při pozdním warmupu, chybějící/selhaný model, řízení vlastního PID, tokenové limity, neúplný kontext a dokumentový náhled bez chatového dumpu. Živý smoke ověřil desktop gateway → skutečný FastAPI subprocess → loopback HTTP provider → běžnou i streamovanou odpověď, finální metadata a parent EOF shutdown. Reálné modelové váhy ani GPU nebyly použity; Windows/Electron instalace a rychlost/obsah `masa-cyber` vyžadují retest. CI/CD není podmínkou předání.

Další ověření na Windows: zavřená Ollama → launcher → otevření Máši → první a druhá krátká odpověď; přerušení a retry; vytvoření poznámky se skriptem, doplnění existující a tři samostatné dokumenty; porovnání load/prompt/generation/TTFT/tok/s. Pro praktické nasazení zůstává zásadní ověřit kvalitu skutečných odpovědí, ne pouze transportní fixtures. Questy nemají tuto část označenou jako hotovou.

## 2026-10-07 — Web Storage v DOM testech a opakování desktop updatu

- Windows launcher stáhl zdroje a zastavil se při frontend testech před sestavením a instalací verze 0.1.95. Všech 25 selhání tří sad začínalo na `localStorage.clear()`: globální Node úložiště bylo nedostupné, přestože soubory používaly prostředí jsdom. Následná chyba `server.closeAllConnections()` vznikala při úklidu HTTP fixture, která se kvůli první chybě vůbec nevytvořila. Nejde o 25 nezávislých chyb chatu.
- `vitest.config.ts` načítá společný `tests/setup.ts`. V DOM prostředí připojí globální `localStorage` i `sessionStorage` ke skutečnému úložišti aktuální instance `jsdom.window`, místo přebírání Node Web Storage. Původní property descriptory se čtou bez spuštění nativního getteru a po sadě se obnoví. Node testy bez jsdom se nemění. Nepoužívá se náhradní Map, diskový storage soubor ani potlačení selhání testů.
- Transport fixture se při každé přípravě inicializuje jako volitelná; úklid zavírá pouze skutečně vytvořený server. Případné selhání přípravy tak nezakrývá další výjimka z teardownu. Přidané dvě regrese ověřují sdílení hodnot mezi aplikačními globály a DOM úložištěm, přepis/odstranění položek a oddělení session/local storage.
- Před opravou Node 24.19 s `--experimental-webstorage` bez diskového storage souboru reprodukoval všech 25 selhání. Po opravě prošlo 81 frontend testů i s tímto nativním getterem, také při jediném workeru. Další běh s přednačtenými globálními gettery vracejícími `undefined` ověřil stav z Windows logu: celé `npm run verify` prošlo, tedy 81 frontend + 35 desktop/helper testů bez skipů a TypeScript + produkční Vite build. `git diff --check` prošel. Python backend se neměnil a jeho sadu tento blok neopakoval; Windows updater ji před instalací nadále vyžaduje. CI/CD není podmínkou předání.
- `DESKTOP.md` doplňuje postup opakování po této chybě. Po stažení opravy zavřít fallback aplikaci a znovu otevřít Ethical World Launcher; dosud neúspěšný commit nemá instalační receipt, takže proběhne nový ověřený build. Testy se nepřeskakují a není potřeba přidávat `--localstorage-file` ani měnit Node pouze kvůli této kolizi. Reálné dokončení Squirrel instalace a ověření Máši zůstává na Windows retestu.

Reference: [Vitest jsdom environment](https://vitest.dev/config/environment), [Vitest setupFiles](https://vitest.dev/config/setupfiles), [Node Web Storage](https://nodejs.org/api/globals.html#localstorage).

## 2026-10-07 — Windows PowerShell 5.1: prázdná cesta v parametru testu

- Další Windows pokus o instalaci 0.1.96 potvrdil opravu Web Storage: všech 81 frontend testů prošlo. Desktop gate se zastavil na jediném helper testu, `Join-Path` v defaultu parametru `InstallerScript` dostal prázdný `$PSScriptRoot`. Build, backend testy a instalace se v tomto pokusu ještě nespustily; nové automatické spouštění Máši proto zatím nebylo tímto výpisem ověřené.
- `test-desktop-scripts.ps1` má nyní prázdný literal default a relativní cestu k instalátoru řeší až po načtení parametrů v těle skriptu. Kořen skriptů se uloží před dot-sourcingem AST funkcí a použije i pro závěrečnou kontrolu. Výslovně předaná cesta zůstává zachovaná. Řeší to známou nekompatibilitu Windows PowerShell 5.1; lokální PowerShell 7.4.7 původní default přijímal, takže předchozí ověření rozdíl neodhalilo.
- AST kontrola zakazuje závislost vrcholových script parametrů na `$PSScriptRoot`/`$PSCommandPath`; výchozí parametry uvnitř funkcí tím neomezuje. Před samotnou opravou nová kontrola selhala na původním defaultu i v PowerShellu 7. Runner nyní ověřuje implicitní cestu z jiného pracovního adresáře a explicitní `-InstallerScript`, bez spuštění instalátoru či změn skutečných zástupců.
- Validace: všech 35 desktop/helper testů prošlo včetně obou PowerShell invokací, bez skipů; všechny desktop PS skripty prošly parse/AST kontrolou a `git diff --check` prošel. Aplikační TS/Python se v tomto bloku neměnil; frontend/build/backend testy se znovu nepouštěly. Windows PowerShell 5.1 a Squirrel nejsou v lokálním Linux runtime dostupné, finální ověření provede další Windows launcher pokus. Test gate, instalační receipt a ochrana lokálních Git změn zůstávají zachované. CI/CD není podmínkou předání.

Reference: [PowerShell issue #4688 — PSScriptRoot v defaultu script parametru](https://github.com/PowerShell/PowerShell/issues/4688).

## 2026-10-07 — obnova backendu a prodleva před první odpovědí

- Windows aktualizace po opravě PowerShell gate dokončila instalaci. Následná kontrola zaznamenala Ollamu ONLINE a FastAPI OFFLINE; v seznamu procesů běžela pouze Ollama, bez EthicalWorld a EthicalWorldBackend. Tento okamžik neprokazuje selhání startu uvnitř spuštěného desktopu. Pozdější chat odpověď potvrdila funkční spojení, ale vysokou prodlevu.
- Baseline `ollama / masa-cyber:latest`: vstup 2 296 tokenů, výstup 18, celkem 2 314; čas formulář → odpověď 48,75 s; load 11,59 s, prompt 10,72 s, generation 0,63 s, 28,5 tok/s. První token v backendu 24,06 s, první text v chatu 48,12 s; prompt 3 402 znaků, jedna kontextová poznámka a dvě zprávy historie. Jde o jednu odpověď; studený/teplý stav modelu a rozdělení CPU/GPU nebyly doložené.
- Rozdíl prvního textu a backendového tokenu je přibližně 24 s, ale hodnoty mají odlišný začátek měření. V odesílání existovalo čekání na prázdný `/api/generate` warmup před skutečným chat requestem. To je prokázaná blokující operace v kódu; bez měření přípravy nelze celé zdržení konkrétní odpovědi připsat právě jí.
- `backend-manager.cjs` řídí automatický start, ověření identity, sdílení souběžných požadavků, retry po neúspěšném startu a obnovu po pádu. Electron otevře okno bez čekání na backend; inicializace, panel a requesty se připojí ke stejné přípravě. Studený start bundled EXE má 45 s místo původních 9 s; dev runtime 15 s. Ukončený kandidát se rozpozná hned, namísto čekání celého timeoutu.
- Přípravu backendu lze vyvolat z preloadu přes trusted IPC. Máša ji provádí při otevření, opakované kontrole a před zprávou. Chyba ukazuje důvod a zachová draft. Automatická obnova probíhá před requestem; již odeslaný POST se automaticky neopakuje. Cizí server ani cizí Python se nepřebírá a neukončuje. Challenge proof, capability a omezení gateway cest zůstávají povinné.
- `logs/backend-startup.log` v Electron userData obsahuje nejvýše 16 startup/exit událostí a omezený stderr, zdroj kandidáta a důvod selhání. Přesnou cestu, stav a zprávu vrací runtime status. Runtime token, env hodnoty klíčů TOKEN/SECRET/PASSWORD/API_KEY a Bearer tokeny se nahrazují; diagnostika neukládá chatové zadání ani obsah poznámek. Selhání zápisu logu nezablokuje backend.
- Foreground kontroly modelu používají `warmup: false`: spustí Ollamu, ověří instalaci vybraného modelu a pokračují bez prázdného generate requestu. Ani otevření panelu, retry, ani submit nezahajují zvláštní předehřátí. Skutečný chat načte váhy a používá keep_alive 15m. Explicitní warmup zůstává podporovaný v runtime API, ale běžné UI ho nevolá. Výběr přesného modelu se zachovává; žádné stahování nebo automatická výměna modelu.
- Metriky odpovědi nově měří `preparationMs` na frontendu před sendAiMessage. Rozbalení rozlišuje přípravu služeb, backendový request, první token v backendu a první text od submitu. Providerové počty, load/prompt/generation a tok/s se nepřepočítávají z celkového času. Starší odpověď bez preparationMs ukazuje pomlčku.
- Běžný chat má stručnější personu a akční instrukce s názvy polí. Zůstává nedůvěryhodnost poznámkového obsahu, omezenost výběru/historie, přesné IDs a složky, READ/ASSIST/AGENT pravidla, bezpečné laboratorní příklady a zákaz tvrzení o uložení před výsledkem. Obsah vybraných poznámek, index, historie ani rozpočty dokumentů se touto úpravou nezkracují.
- Syntetické srovnání proti předchozímu commitu, stejná jedna TLS poznámka, index, složka a dvě zprávy: „Vysvětli TLS“ 2 802 → 1 743 znaků (−37,8 %); „Ahoj Mášo“ 2 799 → 1 740. Zadání „Doplň poznámku TLS o diagram“ i „Přesuň poznámku TLS do Lab“ zachovala přesně stejný provider prompt. Jde o znakové měření, nikoli naměřenou úsporu tokenů, kvality či sekund na skutečném LLM.

Validace: 84 frontend testů, 45 desktop/helper testů a 35 backend testů prošlo (164 celkem, bez skipů), včetně PowerShell 7.4.7 kontroly skriptů. TypeScript + produkční Vite build, syntaxe main/preload/runtime modulů a git diff --check prošly. Nové regrese pokrývají studený start přes původní devítisekundový limit, sdílený start, retry po chybě/pádu, odmítnutí neověřeného serveru, redakci tajemství a zavření během startu; dále foreground přípravu bez generate i při běžícím explicitním warmupu, chybějící model, oddělené UI časování a úplné dokumentové instrukce.

Živý smoke použil skutečný FastAPI subprocess a desktop gateway: chybějící executable → funkční Python kandidát, tři souběžná volání → jeden backend, běžná i streamovaná odpověď s finálními metrikami, ukončení procesu → automatická obnova → další odpověď, zavření přes parent EOF. Provider byl lokální HTTP fixture, bez skutečných modelových vah/GPU. Windows cold/warm odpovědi a obsah skutečného modelu jsou nadále otevřená část výkonového questu. Po aktualizaci přes launcher změřit dvě krátké odpovědi za sebou včetně preparationMs a `ollama ps`; ověřit také tvorbu a doplnění poznámky. CI/CD není podmínkou předání.

Reference: [Ollama Generate API — explicitní načtení a časování](https://docs.ollama.com/api/generate), [Ollama FAQ — keep_alive a CPU/GPU přes ollama ps](https://docs.ollama.com/faq).

## 2026-10-07 — instalace na vlastním PC v README

- README obsahuje postup od předpokladů a přístupu k soukromému repozitáři přes plný clone větve dev/first-runnable až po první sestavení, instalaci a běžné aktualizace přes Ethical World Launcher. Výslovně rozlišuje oprávnění ke Gitu a lokální owner účet; ZIP/shallow clone pro launcher nestačí. Zdrojový checkout zůstává na cestě uložené v konfiguraci launcheru.
- Předpoklady uvádějí Windows x64, Git Credential Manager, Node 24 LTS, funkční Python v PATH a volitelnou Ollamu. Minimum Node 22.13 vychází z nainstalovaného Forge CLI; lokální backend byl ověřený s Pythonem 3.12. První setup nepotřebuje CI/CD ani veřejný Release. PowerShell příklady používají npm.cmd a přímý Python z .venv, bez nutnosti aktivovat prostředí nebo měnit trvale execution policy.
- Nový PC dostává postup explicitního stažení veřejného qwen2.5:7b a výběru přesného modelu/Base URL. Vlastní masa-cyber alias není předpokládaný. Automatický desktop start FastAPI/Ollamy je odlišený od samostatného modelového serveru při webovém vývoji.
- Doplněné vývojové cesty: Electron na Windows, web ve dvou terminálech na Windows a web na Linuxu/macOS, plus lokální kontroly. Volba stejného browser originu zachovává přístup ke stejnému IndexedDB vaultu. README odkazuje na DESKTOP.md; jeho úvod nyní rozlišuje aktuální Git launcher a volitelný Releases updater bez vzájemně rozporných instrukcí.
- Validace: příkazy porovnané s package.json, launcher/install/update skripty a backend entrypointem; všech osm PowerShell bloků prošlo parserem v PowerShellu 7.4.7, Bash blok prošel bash -n. Všechny uvedené npm scripts, lokální README odkazy a nové odkazy na nadpisy existují; git diff --check prošel. Návod nespouští instalaci v lokálním Linux prostředí ani nestahuje modelové váhy. Aplikační kód se nemění, úplné testy/build se kvůli dokumentaci neopakují. Čistá první Windows instalace je samostatný praktický retest.

## 2026-10-07 — veřejné klonování a Git aktualizace

- Aktuální GitHub API potvrzuje visibility=public a private=false. README a DESKTOP.md nyní popisují veřejné HTTPS klonování i fetch bez GitHub účtu, tokenu nebo přidělení přístupu. Pokyny odpovídají současnému stavu repozitáře; SSH alternativa nadále vyžaduje nastavený klíč.
- Git launcher zůstává doporučenou cestou instalace a aktualizací. Veřejná viditelnost zdrojů se odlišuje od publikace instalačních Releases a jejich explicitně zapínaného Electron updateru. Kód launcheru, nastavení updateru ani oprávnění GitHub konektoru se v tomto dokumentačním bloku nemění.
- Validace: aktuální stav a základ větve ověřené přes GitHub API, PowerShell příklady v README syntakticky zkontrolované a git diff --check prošel. Předchozí záznamy vývoje popisují tehdejší předpoklady; tento záznam je doplňuje aktuálním veřejným stavem.

## 2026-10-07 — Máša: hranice promptu, akcí a síťových obrázků

- Aktuální desktop měření: první text 1,08 s, backend first token 0,67 s, příprava služeb 0,39 s, load 0,02 s, prompt 0,10 s a generování 25,79 s při 29,8 tok/s. Dlouhá odpověď obsahovala interní instrukce; rychlý nástup odpovědi tedy sám o sobě neprokazoval její kvalitu. Tato oprava nevydává nové měření GPU/modelové rychlosti.
- Pravidlový prompt už neobsahuje těla ani index/metadatové výpisy vaultu. Kontext se serializuje jako nedůvěryhodný JSON do samostatné user zprávy před historií. Escapování známých šablonových role tokenů platí i pro historii a poslední dotaz. API přijímá jen user/assistant historii zakončenou user zadáním; note IDs a cesty mají velikostní limity. Úplnost poznámek, dokumentový budget, Mermaid a vícepoznámkový protokol zůstávají zachované. Metrika historie nepočítá přidaný kontext jako další konverzační zprávu.
- Normální chat má odpovídat přímo, bez opisu pravidel a opakovaného představování. Uvítání panelu se neposílá zpět modelu. Backend guard zastaví 20 souvislých normalizovaných slov z aktuálních interních pravidel v dokončené i průběžné odpovědi; pokrývá i variantu Jsi/Jsem Máša. Možný opis na začátku krátce zadrží, při chybě uzavře provider stream a nevrátí final/akce. UI obnoví draft a odmítnutou odpověď nezapíše do historie. Bez dalšího LLM volání či skrytého retry. Guard není detektor všech injection/parafrází a může odmítnout dlouhou citaci pravidel.
- Automatický AGENT grant se odvozuje pouze z lokálního UI a konkrétního requestu. Automatické create_note je povolené pouze v přesně vybrané složce při prvním zadání bez existujících poznámek, aktivní note a historie. S vaultem nebo konverzací všechny změny čekají na konkrétní potvrzení. Nesouvisející folder metadata se izolovanému requestu nepřidávají. Režim a scope se znovu ověří těsně před provedením; údajné souhlasy v modelovém JSONu nic nepovolují. Tato záměrně užší autonomie brání tichému zápisu z importovaných instrukcí.
- RemoteImage měl souhlas pouze jako boolean, který při změně src přetrval. Souhlas je nyní vázaný na přesnou URL včetně query; nový cíl vyžaduje nové kliknutí. Regrese ověřuje nahrazení dříve schváleného obrázku potenciální exfiltrační URL i zakázané URL schemes.
- Lokální validace: 94 frontend testů, 44 Node testů v npm run verify plus samostatně úspěšný PowerShell helper test s portable PS 7.4.7 (v základním PATH chybí pwsh), TypeScript a Vite build. Backend: všech 44 testů prošlo v úplném závěrečném běhu, včetně 9 chat-safety testů. Skutečný FastAPI proces přes ověřený desktop gateway a HTTP fixture provider ověřil normální/stream odpověď, oddělení podvržené note od systémové zprávy, odmítnutí opisu (HTTP 502 i stream error), uzavření provider HTTP spojení před dokončením a obnovu backendu. Žádný reálný Windows/GPU/model nebyl v tomto prostředí testovaný. React kontrola: bez nových efektů či síťových waterfallů, grant zachycený pro request a aktuální práva v refs, URL souhlas odvozený z konkrétního src, tlačítka zachovávají přístupnost.
- Další retest: po launcher aktualizaci vyzkoušet běžný český dotaz, legitimní vysvětlení prompt injection a poznámku obsahující falešné instrukce/souhlas. Ověřit přímou odpověď, návrh místo tichého zápisu a potvrzení pro nový obrázek. Kvalitu masa-cyber a jeho šablony nadále ověřit na desktopu; žádný regresní smoke test neznamená stoprocentní odolnost proti adaptivnímu útočníkovi.

## 2026-10-07 — aktualizace průběžného auditu

- AUDIT.md je srovnaný s aplikačním základem b292894: původní nálezy mají aktuální stav, konkrétní zdroj/regresi a zbývající ověření. Historický audit z 4. 10. zůstává odkazovaný jako Git snapshot, místo aby staré otevřené závady působily jako současný stav.
- Doplněné hranice promptu/akcí, omezený echo guard, URL-bound souhlas obrázků, backend/launcher lifecycle, skutečná desktop měření s omezením jejich srovnatelnosti a přesné rozdělení 183 lokálně ověřených testů. Nativní Windows a reálný masa-cyber retest zůstávají otevřené.
- Zbývající debt zahrnuje Notion key storage/replace race, izolaci dat podle účtu, graph O(n²), export preview, build dependency lock a širší GitHub scope. Statická kontrola navíc doložila nesoulad CI Node 20 s Forge CLI 8.0.1 engines >=22.13.0; běh CI se neověřoval a změna konfigurace není součástí tohoto dokumentačního commitu.
- Validace: zdroje a existující testy porovnané s nálezy, lokální odkazy/cesty a git diff --check. Aplikační kód se nemění; úspěšné aplikační testy/build se neopakují a na CI/CD se nečeká.

## 2026-10-07 — CI toolchain a ochrana GitHub Device OAuth

- Příčina neúspěšných Actions byla ověřená z obou check annotations běhu 37624651002: “The job was not started because your account is locked due to a billing issue.” Frontend ani backend nemají spuštěné kroky, job logs nejsou dostupné. Toto není test failure a Node upgrade sám účet neodblokuje. Standardní hosted runnery veřejného repozitáře jsou zdarma; po odstranění blokace v GitHub Billing je nutné zopakovat skutečné Actions. Zelený hosted stav se netvrdí.
- CI používá Node 24, Python 3.12 a Ubuntu 24.04/Windows 2022 matice. Opravený nesoulad Node 20 s Forge >=22.13.0; minimum je v package manifestu i locku, .nvmrc doporučuje 24. PowerShell helper je v Actions povinný, žádné continue-on-error nebo skryté přeskakování. Backend běží přes UTF-8 test_runner. Workflow nic nepublikuje, má contents: read, checkout nepersistuje credentials, akce jsou připnuté na ověřené full SHA a caches na konkrétní lockfiles.
- GitHub Device OAuth token se dříve ukládal před /user a pending exchange mohl po disconnect znovu uložit credential. Samostatný main-process auth runtime nyní vlastní jednu operaci, TTL, abort controller, single-flight polling, pending/slow_down a společnou credential frontu. Cancel/disconnect/reload/window close odmítá late responses, cancel během save obnoví původní token, disconnect se provede po rozpracovaném save. Starší HTTP 401 nemůže smazat novější credential.
- Sdílený Client ID odstraněný; OAuth vyžaduje vlastní ETHICAL_GITHUB_CLIENT_ID s povoleným Device Flow. Native token fallback zůstává. Default public_repo, širší private repo scope pouze po explicitní volbě; read:user se nežádá. Nativní dialogy potvrzují Client ID/scope, zobrazí skutečný GitHub kód před otevřením prohlížeče a potvrdí ověřený účet před save. Token grant i skutečná X-OAuth-Scopes hlavička musí být podmnožinou schváleného přístupu. Přesné HTTPS endpointy, žádné redirecty, bounded/formatted codes a sanitizované chyby. Renderer nedostává token ani device_code; privilegované IPC vyžaduje vlastní main frame i při same-origin iframe.
- UI má public/private výběr, Zrušit přihlášení a abortovatelný polling timer; unmount/pozdní výsledek neobnoví starou UI session. Produktový souhlas probíhá nativně mimo obsah poznámek. Regrese pokrývají malformed/širší grant, neplatný účet, expiraci, souběžné starty/polls, slow_down, cancel během account consent/persistence, disconnect při late response a ochranu před stale 401. Integrační fixture provádí skutečný preload a main handlers, nikoli pouze kopii handler logiky.
- Závěrečná validace: npm run verify s portable PowerShell v PATH a GITHUB_ACTIONS=true: 97 frontend + 60 Node testů, 0 skip, TypeScript a Vite build. Python compileall + celý server.test_runner: 44 testů. Celkem 201 unikátních úspěšných testů. YAML/permissions/matrices/full SHA ověřené strukturálně; actionlint release download nebyl dostupný, tento nástroj se netvrdí jako spuštěný. Skutečný Windows/Electron GUI ani živý GitHub grant nebyly lokálně ověřené; čekají na nativní/hosted retest.
- README/DESKTOP/SECURITY/AUDIT popisují aktuální přihlášení, konfiguraci a billing blocker. Stávající tokeny se automaticky nezúží ani vzdáleně nerevokují. Ochrana uvnitř Ethical World nezabrání schválení útočníkova Device OAuth kódu mimo aplikaci; public_repo i repo stále zahrnují širší přístup než Contents. Pro vybraná repa doporučený fine-grained PAT; další debt je GitHub App. React kontrola: hooks bez podmíněného pořadí, refs pro lifetime, cleanup ruší timer/flow, přístupný select a tlačítka, žádný nový chat/model call.

- Ověření po pushi: aplikační commit 83fab9a64058f2c31705aadd74e589d07805876b má přesně lokálně ověřený tree 3c8d165747712ce2802c760c90c681392f84a6c6. Actions run 37628952625 vytvořil všechny 4 matrix jobs, ale všechny skončily bez kroků/logs se stejným billing lock. Anotace všech čtyř checků byly přečtené; nesoulad runner verze ani testy nebyly příčinou tohoto neúspěšného běhu. Další změna je pouze záznam výsledku v dokumentaci; aplikační testy se bez změny kódu neopakují.

## 2026-10-07 — viditelný stav CI v README

- Na začátku README je datované vysvětlení GitHub Billing blokace s přesnou anotací a odkazem na ověřený běh 37629754595. Odděluje 201 lokálně úspěšných testů/build od dosud neprovedených hosted kontrol a odkazuje na audit i postup odblokování/opakování CI.
- Stav a příčina jsou už doložené v AUDIT.md a předchozím záznamu. Validace tohoto dokumentačního doplnění: aktuální branch head/běh, odkazy a git diff --check. Aplikační kód se nemění.
