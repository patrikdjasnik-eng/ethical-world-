# Deep Audit

![Audit](https://img.shields.io/badge/audit-2026--10--04-7c3aed)
![Scope](https://img.shields.io/badge/scope-bugs_%2B_security-334155)
![Branch](https://img.shields.io/badge/branch-dev%2Ffirst--runnable-6f42c1)

Audit je statická kontrola implementace, trust boundaries, datové integrity, AI action flow, Electron desktop vrstvy, FastAPI backendu, konektorů a testů.

GitHub Actions jsou v době auditu blokované mimo samotné testovací kroky: frontend i backend job končí bez jediného `step` a bez logu. Proto zde není tvrzení, že aktuální HEAD prošel runnerem. Repo aktuálně obsahuje 44 explicitních test cases napříč Vitest a Node test runnerem.

## Opraveno během auditu

### P0 — Electron navigation + privileged preload bridge

Původní stav:

- hlavní BrowserWindow měl `contextIsolation`, sandbox a vypnutý Node integration;
- preload ale vystavoval privilegované API pro sessions, GitHub, Markdown filesystem a Carrot;
- `setWindowOpenHandler` řešil pouze nová okna;
- nebyl `will-navigate` guard;
- IPC handlery nekontrolovaly URL/origin senderu.

Riziko:

Importovaná Markdown poznámka mohla obsahovat běžný externí odkaz. Navigace stejného BrowserWindow na cizí stránku by mohla ponechat preload bridge dostupný v novém dokumentu. Cizí obsah by tím získal cestu k privilegovaným IPC operacím.

Hotový fix:

- každá top-level navigace se blokuje přes `will-navigate`;
- bezpečné `http/https` URL se otevírají mimo aplikaci;
- zakázané protokoly jako `javascript:`, `data:` a `file:` se neposílají do `shell.openExternal`;
- nové window requests jsou vždy denied;
- webview attach je denied;
- každý IPC handler jde přes `handleTrusted()`;
- IPC sender musí být aktuální Ethical World BrowserWindow a jeho URL musí odpovídat povolenému dev originu nebo souboru uvnitř packaged `dist`;
- přidán samostatný Node security test suite.

### P1 — Carrot integrity

Původní stav ověřoval Ed25519 podpis nad uloženým `snapshotHash`, ale znovu nepřepočítával hash reálného `title/folder/content`.

Hotový fix:

- recompute snapshot hash;
- recompute commit hash;
- kontrola parent ID + parent commit hash;
- propagace rozbitého parent chainu;
- tamper testy;
- ověření celé načtené historie, ne jen UI výřezu.

### P1 — session revocation

Původní stav:

- logout smazal session token pouze z renderer storage;
- serverová session zůstala platná do expirace;
- změna hesla nerušila ostatní session tokeny;
- starší bootstrap session mohla teoreticky přežít změnu hesla.

Hotový fix:

- nový serverový `/api/auth/logout`;
- logout revokuje hash session v SQLite;
- změna hesla revokuje všechny ostatní sessions uživatele a zachová pouze session, která změnu právě autorizovala.

### P2 — Notion OAuth callback HTML

Workspace name a error text se vkládaly přímo do HTML callback stránky.

Hotový fix:

- HTML escaping;
- callback odpověď dostává `Content-Security-Policy: default-src 'none'`.

### Funkční dokončení

- Mermaid už není pouze source code: Preview má skutečný lazy-loaded lokální renderer v strict režimu;
- Mermaid parse error má bezpečný code fallback;
- Máša panel po schování neztrácí session;
- batch approvals mají `Použít vše`;
- ROADMAP, STRUCTURE, SECURITY, AI, CARROT a README byly srovnané s reálnou implementací.

---

## Otevřené nálezy

### P1 — backend na portu 8787 nemá runtime identity

Electron považuje backend za důvěryhodný, pokud `http://127.0.0.1:8787/health` pouze vrátí úspěšný HTTP status.

Pravděpodobný útok:

1. cizí lokální proces obsadí port 8787 dřív než Ethical World;
2. vrátí falešný health response;
3. desktop označí runtime jako `external`;
4. renderer mu následně posílá auth requesty, hesla, session tokeny, vault context nebo AI API key.

Doporučený fix:

- při startu Electronu generovat náhodný runtime capability token;
- předat jej pouze vlastně spuštěnému backend procesu přes environment/pipe;
- health handshake musí challenge ověřit;
- renderer-backend requesty musí mít runtime capability nebo musí jít přes main-process proxy;
- v packaged režimu nedůvěřovat anonymnímu procesu pouze proto, že odpovídá na portu.

### P1 — owner bootstrap má first-use race

`POST /api/auth/bootstrap-owner` je před prvním nastavením hesla dostupný bez autentizace na loopback backendu.

Po dnešním session fixu starý bootstrap token nepřežije změnu hesla, ale jiný lokální proces stále může bootstrap získat jako první a pokusit se owner účet převzít.

Doporučený fix:

- desktop-only one-time bootstrap capability;
- capability držet v Electron main procesu, ne v renderer storage;
- endpoint bez capability vrací 403;
- capability po prvním úspěšném použití okamžitě zneplatnit.

### P1 — packaged renderer ↔ FastAPI CORS je vysoce pravděpodobný integrační bug

Packaged Electron načítá `dist/index.html` přes `file://`.

FastAPI standardně povoluje pouze:

- `http://localhost:5173`;
- `http://127.0.0.1:5173`.

File documents mají v moderních browserech typicky opaque origin serializovaný jako `null`. Přidat CORS allowlist `null` není bezpečné řešení.

Proto je potřeba reálný packaged E2E test auth/health/chat. Backend spawn test sám nestačí.

Doporučený fix:

- preferovat vlastní secure app protocol nebo main-process API proxy;
- nepoužívat `Access-Control-Allow-Origin: null`;
- packaged renderer nesmí vypínat `webSecurity`.

### P1 — local Markdown writer má symlink/junction escape gap

`resolveInsideRoot()` kontroluje lexikální path traversal, ale write flow nekontroluje, zda existující parent část cesty není symlink/junction vedoucí mimo approved root.

Příklad:

```text
approved-root/
  escape -> C:\Users\...\outside
```

Write na `escape/note.md` může projít lexikální kontrolou, ale filesystem ho může fyzicky zapsat mimo root.

Doporučený fix:

- canonical/realpath approved root;
- před zápisem projít existující parent segmenty přes `lstat`;
- reject symlink/reparse-point chain;
- před finálním write znovu ověřit canonical parent path;
- Windows test musí zahrnout junction.

### P1 — autosave může ztratit poslední edit při rychlém switchi

Aktivní note se ukládá přes 450ms timeout navázaný na `activeNote`.

Pokud uživatel:

1. napíše změnu;
2. přepne note dřív než timeout doběhne;
3. zavře aplikaci bez návratu k původní note;

cleanup timeout zruší a stará note nemusí být zapsaná do IndexedDB. Stejný problém může přeskočit Carrot snapshot.

Doporučený fix:

- persistence queue per note ID;
- flush před změnou active note;
- flush při app/window close;
- Carrot commit spustit až po úspěšném persistence flush.

### P1 — connector export nemá conflict/diff guard

Local Markdown a GitHub export mohou zapisovat přes existující Markdown path. Notion používá `replace_content`.

Navíc GitHub/local export nyní mapuje celý vault, nejen notes patřící danému connectoru.

Riziko je spíš data integrity než RCE:

- nechtěný overwrite dokumentace;
- export interních notes do špatného repa;
- ztráta externích změn;
- replace celého Notion page bez diff preview.

Doporučený fix:

- defaultně exportovat pouze notes daného connectoru;
- `Export all` jako explicitní volba;
- před zápisem vytvořit dry-run manifest;
- classify create/update/conflict;
- conflict vyžaduje explicitní potvrzení.

### P1 — dependency graph není reprodukovatelně zamčený

Repo nemá:

- `package-lock.json`;
- `pnpm-lock.yaml`;
- `yarn.lock`.

Node dependency install tedy používá rozsahy z `package.json`. Python requirements jsou také rozsahové.

Dopad:

- dva buildy nemusí dostat stejné transitive dependencies;
- CI nemůže používat `npm ci`;
- supply-chain audit nemá stabilní dependency snapshot.

Doporučený fix:

- vytvořit a commitnout npm lock;
- přejít v CI na `npm ci`;
- zvážit Python constraints/lock;
- přidat `npm audit`/OSV a `pip-audit` jako oddělený security job.

### P2 — chybí CSP a Markdown umí remote image fetch

`index.html` nemá Content Security Policy.

React Markdown může zobrazit remote images z importovaných notes. To znamená, že otevření nedůvěryhodné Markdown poznámky může udělat síťový request na cizí host a prozradit například IP/čas otevření.

Doporučený fix:

- explicitní CSP pro desktop/web build;
- custom Markdown image renderer;
- remote images defaultně blokovat nebo načítat až po potvrzení;
- případně allowlist pro známé badge/image originy.

### P2 — provider baseUrl je libovolný HTTP target bez capability gate

FastAPI přijímá `baseUrl` z rendereru a backend přes něj provádí HTTP request.

Je to částečně záměr kvůli Ollama/OpenAI-compatible remote endpointům, ale chybí bezpečnostní policy:

- validace schématu;
- explicitní remote-provider režim;
- ochrana proti link-local/cloud metadata targets;
- runtime authentication backendu.

Doporučený fix:

- pouze `http/https`;
- loopback povolen automaticky;
- remote host vyžaduje explicitní user opt-in;
- link-local/metadata IP rozsahy blokovat defaultně;
- request timeout/size limit a circuit breaker.

### P2 — Graph related edges mají O(n²) hot path

`buildKnowledgeGraph()` porovnává každý pár notes a uvnitř každého páru znovu tokenizuje title a parsuje hashtags.

U stovek až tisíců notes může UI zamrznout.

Doporučený fix:

- precompute token/tag feature map jednou per note;
- worker pro velké vaulty;
- related-edge limit/top-K;
- performance budget test pro 100/500/1000 notes.

### P2 — batch `Použít vše` neumí závislé akce

`applyAllActions()` používá stejnou callback closure pro celý batch.

Příklad:

```text
1. create_folder Cyber/New
2. create_note folder=Cyber/New
```

Druhá akce může stále kontrolovat starý `folders` snapshot a selhat.

Doporučený fix:

- doménový action executor nad aktuálním mutable/transactional state;
- nebo dependency graph batch actions;
- po každém kroku aktualizovat working state před validací dalšího.

### P2 — Notion encryption key je lokální file vedle dat

Fernet payload v SQLite je šifrovaný, ale fallback `connector.key` je ve stejném user data prostoru.

To chrání před izolovaným únikem DB, ale ne před útočníkem se čtením celého user data adresáře.

Doporučený fix pro Windows desktop:

- master key přes Electron `safeStorage` / DPAPI;
- backend dostane krátkodobý unwrap key/capability od main procesu;
- plaintext master key neukládat vedle DB.

### P3 — Notion OAuth states nemají TTL/limit

`_oauth_states` je in-memory map bez expirace. Nedokončené login flows zůstávají do restartu backendu.

Fix:

- uložit `created_at`;
- 10–15 minut TTL;
- limit aktivních states per user;
- cleanup při start/status.

### P3 — `bootstrap_admin_from_env` nevytváří admin role

Funkce se jmenuje bootstrap admin, ale volá `register_user()`, který vždy zapisuje roli `user`.

Buď funkci přejmenovat, nebo explicitně implementovat očekávanou privileged roli. Aktuálně je název zavádějící.

---

## Další testovací balík

Doporučený další balík není jedna obří E2E sada. Rozdělit jej na rychlé vrstvy.

### Tier A — každý push

#### Vitest

Nové soubory:

- `tests/autosave.test.tsx`
  - edit → switch <450ms → data se neztratí;
  - close/flush;
  - Carrot vzniká po persistenci.

- `tests/agentWorkflow.test.tsx`
  - dependent batch `create_folder → create_note`;
  - partial batch failure;
  - `Použít vše` zachová pořadí;
  - stale note ID;
  - stale folder.

- `tests/markdownConnector.security.test.ts`
  - Windows reserved names;
  - duplicate paths;
  - traversal normalization;
  - source-only export policy;
  - conflict manifest.

- `tests/mermaid.security.test.tsx`
  - malformed diagram fallback;
  - huge input;
  - click/init directive policy;
  - renderer nesmí spadnout.

- `tests/graph.performance.test.ts`
  - deterministic result;
  - 100/500/1000 synthetic notes;
  - budget pro related-edge build.

#### Node test runner

Rozšířit `tests-electron/security.test.cjs`:

- trusted IPC URL;
- remote URL reject;
- `javascript/data/file` external URL reject;
- packaged dist containment;
- navigation policy;
- fake external renderer nesmí mít IPC capability.

Nový:

- `tests-electron/markdown-paths.test.cjs`
  - symlink/junction escape;
  - canonical root;
  - write target outside root = reject.

### Tier B — FastAPI security integration

Přidat `pytest` a izolovaný temp data dir.

`server/tests/test_auth_security.py`

- password hash není plaintext;
- session DB obsahuje pouze hash;
- logout revokuje token;
- password change ruší jiné sessions;
- bootstrap je single-use/capability gated po implementaci;
- expired token = 401;
- malformed bearer = 401.

`server/tests/test_provider_security.py`

- scheme allowlist;
- invalid URL;
- blocked link-local metadata target;
- provider timeout;
- oversized response;
- runtime capability required;
- fake process na 8787 neprojde handshake.

`server/tests/test_notion_security.py`

- OAuth state mismatch;
- OAuth state expiry;
- callback HTML escaping;
- connector secret není vrácen rendereru;
- oversized Markdown write reject.

### Tier C — Electron packaged E2E na Windows

Použít Playwright Electron nebo současný PowerShell smoke skript rozšířit o skutečný renderer test.

Povinné scénáře:

1. spustit packaged app;
2. renderer načten;
3. backend handshake prošel;
4. `/health` dostupný z renderer flow;
5. owner bootstrap/password flow;
6. restart a session restore;
7. fake server na 8787 → app jej odmítne;
8. kliknutí na externí Markdown link → app nenaviguje;
9. remote page nemůže použít preload IPC;
10. lokální fake OpenAI-compatible server → Máša odpoví;
11. Mermaid preview se vykreslí;
12. hide/show Máša zachová konverzaci.

Tohle je test, který definitivně rozhodne i současnou otázku packaged `file://` CORS.

### Tier D — fuzz/property tests

Volitelně `fast-check` / Hypothesis:

- agent action JSON parser;
- `<ethical-note>` envelope;
- wiki links;
- Markdown path sanitizer;
- folder normalizer;
- GitHub relative paths.

Cíl je najít kombinace Unicode, slashů, nulových znaků, extrémních délek a nested inputů, které ruční příklady nepokryjí.

### Tier E — supply chain

Samostatný job, aby dependency outage nerozbila běžné unit tests:

- `npm ci`;
- `npm audit --omit=dev` nebo OSV scanner;
- `pip-audit -r server/requirements.txt`;
- dependency license snapshot;
- kontrola lockfile změn v PR.

---

## Doporučené pořadí další práce

1. runtime identity/capability pro backend;
2. owner bootstrap capability;
3. packaged renderer E2E + vyřešit CORS bez `Origin: null`;
4. autosave flush;
5. symlink-safe Markdown writer;
6. connector conflict/diff policy;
7. lockfile + supply-chain job;
8. CSP + remote image policy;
9. graph performance;
10. Notion key storage a OAuth state TTL.

Dokud nejsou hotové první tři body a packaged E2E, projekt je kvalitní development MVP, ale neměl by se označovat za security-hardened release.
