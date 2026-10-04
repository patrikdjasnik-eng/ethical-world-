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

### 4. Nativní Ethical World Windows ikonka

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

### 5. Installer / packaging green

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
