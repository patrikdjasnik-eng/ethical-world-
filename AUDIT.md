# Deep Audit

![Audit](https://img.shields.io/badge/audit-2026--10--07-7c3aed)
![Scope](https://img.shields.io/badge/scope-bugs_%2B_security-334155)
![Branch](https://img.shields.io/badge/branch-dev%2Ffirst--runnable-6f42c1)

Aktualizovaný stav auditu k 7. 10. 2026 pro větev `dev/first-runnable`. Předchozím aplikačním základem je commit [`b292894`](https://github.com/patrikdjasnik-eng/ethical-world-/commit/b292894fd7822dbcc1358f681c6491ed27e8fdf7), navazující opravy CI a GitHub Device OAuth, kontrola současného kódu a lokální validace. [Původní report z 4. 10.](https://github.com/patrikdjasnik-eng/ethical-world-/blob/b292894fd7822dbcc1358f681c6491ed27e8fdf7/AUDIT.md) zůstává dostupný jako historický snapshot.

Audit zahrnuje Electron/IPC, identitu FastAPI runtime, účty a sessions, AI request → model → návrh → zápis, Markdown/Mermaid preview, konektory, Carrot integritu, launcher a závislosti. Rozlišuje opravu doloženou kódem a regresí od nativního Windows/modelového retestu. Repo je veřejné; Git HTTPS clone/fetch nevyžaduje GitHub přihlášení.

Aktuální ověřený hosted základ je commit `0403da0`: [běh 37660876897](https://github.com/patrikdjasnik-eng/ethical-world-/actions/runs/37660876897) úspěšně provedl frontend i backend na Ubuntu 24.04 a Windows 2022. Dřívější billing blokace je historická. Tento dokument níže zachovává původní rozsah; navazující opravy a testy všech 11 nově reprodukovaných nálezů jsou v [AUDIT-REMEDIATION.md](AUDIT-REMEDIATION.md).

## Stav původních nálezů

Priorita odpovídá původnímu reportu; sloupec stav popisuje současnou implementaci.

| Původní nález | Stav k 7. 10. | Oprava a důkaz | Co zbývá |
| --- | --- | --- | --- |
| P0: navigace k cizímu obsahu s privilegovaným preloadem | Opraveno v kódu a regresích | `electron/security.cjs`, trusted IPC v `main.cjs`; povolený renderer origin/dist, blokování navigace/webview a nevhodných external URL; `tests-electron/security.test.cjs` | Nativní packaged navigace a IPC E2E |
| P1: Carrot neověřuje skutečný obsah | Opraveno | Přepočet snapshot/commit hash a parent chain v `src/lib/carrot.ts`; `tests/carrot.test.ts` | Vícezařízení a rotace klíčů nejsou dokončený produktový protokol |
| P1: Carrot důvěřuje klíči z libovolného commitu | Opraveno pro desktop | Trust anchor, trusted public keys a potvrzená hlava mimo IndexedDB v `electron/secure-store.cjs`; regrese cizího signeru a rollbacku v `hardening.test.cjs` | Webová varianta má unsigned historii; týmový enrollment/revocation a rotace zůstávají otevřené |
| P1: anonymní server na 8787 je považovaný za backend | Opraveno | Náhodná capability, challenge/HMAC proof a gateway přes Electron main; fake backend nesmí dostat capability ani heslo | Packaged test na Windows s cizím procesem a následným restartem |
| P1: first-use owner bootstrap race | Opraveno pro runtime boundary | Capability gate, single-use bootstrap pod lockem; neoprávněný klient a druhý bootstrap odmítnuty v `server/tests/test_security.py` | Nenahrazuje izolaci před kompromitovaným OS účtem |
| P1: packaged `file://` renderer ↔ FastAPI CORS | Komunikační cesta opravena; nativní retest otevřený | Omezené IPC/main-process gateway místo přímého renderer fetch; `Origin: null` zůstává odmítnutý; reálný HTTP transport test | Úplný packaged auth/chat E2E, bez vypnutí `webSecurity` |
| P1: symlink/junction escape lokálního Markdown writeru | Opraveno v kódu a regresi | `realpath`/`lstat`, odmítnutí symlinků, neplatných segmentů a reserved names; opakovaná kontrola před zápisem | Junction větev regresního testu dosud nebyla spuštěna na skutečných Windows |
| P1: poslední edit se ztratí při rychlém přepnutí poznámky | Opraveno pro běžný flow | Snapshot write queue, flush před navazujícími změnami a viditelná chyba zápisu; skutečný App/IndexedDB test edit → rychlý switch → remount | Nativní zavření při probíhajícím zápisu a obnovovací scénář po pádu; žádný příslib zápisu při násilném ukončení OS |
| P1: connector export přepíše cizí změny / celý vault | Částečně uzavřeno | Defaultně jen notes daného konektoru, explicitní Export all; local preflight/hash/backup, GitHub blob baseline + non-force branch update, Notion kontrola baseline | Jednotný dry-run/diff preview; Notion read → replace není atomická operace |
| P1: nezamčený dependency graph | Opraveno pro npm a runtime Python | `package-lock.json`, `npm ci`, `server/requirements.lock.txt`; Windows marker pro uvloop | Build requirements jsou nově přesně připnuté; lock nemá Python hash enforcement; průběžná advisory kontrola |
| P1: logout/změna hesla ponechá jiné sessions | Opraveno | Serverová revokace a kontrola token hash; regrese logout/password change | Oddělení vaultů mezi lokálními účty není implementované |
| P2: Notion callback HTML injection | Opraveno v kódu | HTML escaping a callback CSP `default-src 'none'` | Reálný OAuth callback při integračním retestu |
| P2: chybí CSP, remote Markdown obrázky se načítají samy | Opraveno; URL souhlas dále zpřesněný | CSP ve Vite HTML transformu, `RemoteImage` vyžaduje kliknutí pro přesnou HTTPS URL včetně query; `tests/remoteImage.test.tsx` | Kliknutí stále odešle celou URL cílovému serveru |
| P2: libovolná provider URL / metadata SSRF | Opraveno pro provider proxy | URL/DNS policy, loopback nebo povolený HTTPS host, IP pinning, Host/TLS identity, zákaz redirectů a response limits; backend regrese | Nové providery přidávat vědomě do allowlistu; důvěryhodnost jejich odpovědí není odvozena z HTTPS |
| P2: graph znovu tokenizuje každý pár poznámek | Opraveno v navazujícím auditu | Invertovaný index, top-K, limity hran a Web Worker; regrese 2 000 poznámek | Výslovné wiki odkazy nejsou potlačené limitem souvisejících hran |
| P2: závislý batch používá starý snapshot složek | Opraveno pro pořadí a aktuální stav | App executor používá aktuální refs; test create_folder → create_note → rename/move/task/link proti IndexedDB | Batch není jedna atomická transakce; případná dřívější úspěšná změna se automaticky nevrací |
| P2: auth nemá rate limit | Základní ochrana implementovaná | Capability před auth, limit 40 auth požadavků/minutu per client IP, scrypt mimo event loop; chat má limit dvou souběžných requestů | Regrese auth limitu a jeho recovery, silnější per-account policy podle potřeby |
| P3: sessions se nečistí | Opraveno při vytváření session | Mazání expirovaných řádků a omezení historie sessions per účet v `_create_session()` | Není periodický cleanup bez dalšího přihlášení |
| P3: Notion OAuth state nemá TTL/limit | Opraveno v kódu, expiry regresi | 10min TTL, cleanup při startu flow, nejvýše 5 otevřených flow per účet; expired state odmítnutý před sítí | Retest limitu a cleanup kombinací |
| P2: Notion encryption key leží vedle dat | Opraveno pro spravovaný desktop | Migrace do OS secure storage s read-back před odstraněním plaintextu; klíč dostane jen spuštěný backend | Samostatný Python backend musí dostat bezpečně dodaný env klíč; fallback mimo desktop zůstává kompatibilní |
| P3: `bootstrap_admin_from_env` vytvoří běžný účet | Název zůstává zavádějící | Implementace výslovně vytváří běžný účet, privilegovaný owner má samostatný bootstrap | Přejmenovat funkci/env dokumentaci; nejde o grant admin práv |

## Nové opravy: Máša a prompt injection

### Oddělení instrukcí, kontextu a oprávnění

Dříve se obsah poznámek, index i názvy složek připojovaly přímo do systémové zprávy. Nyní systém obsahuje pravidla/protokol a vybraný vault jde jako nedůvěryhodný JSON do samostatné user zprávy před konverzací. Poslední zpráva musí být user zadání; klient nesmí vložit system roli. Známé ChatML/Llama/INST tokeny se v datech i historii převádějí na doslovný text. UI uvítání se modelu neposílá jako dřívější modelová odpověď.

Tato struktura sama nezaručuje odolnost modelu proti přirozeným podvrženým příkazům. Rozhodující ochrana zápisu je mimo LLM:

- READ nepřijímá akce; ASSIST vyžaduje konkrétní potvrzení.
- AGENT automaticky povolí jen `create_note` v přesné složce z UI při prvním zadání bez existujících poznámek, aktivní note a historie. Izolovaný request nepřidává nesouvisející folder metadata.
- S vaultem nebo historií čekají všechny změny na potvrzení. Modelové `user_confirmed`, údajné system role ani scope v poznámce neudělují práva.
- Platnost grantu, aktuální režim, typ akce a přesná cílová složka se kontrolují znovu před automatickým provedením. Parser přijímá omezené akce/argumenty; LLM nemá shell, mazání ani konektorové či síťové tools.
- Úplný přepis existující note vyžaduje úplný modelový vstup a nezměněný snapshot cíle; provedení má lokální audit.

Důkaz: `server/tests/test_chat_safety.py`, `tests/agentPolicy.test.ts`, `tests/agentTools.test.ts`, `tests/aiPanel.test.tsx` a skutečný request přes klient/gateway v `tests/chatTransport.test.tsx`. Vybrané adversarial případy neprokazují procentuální odolnost modelu ani ochranu před kompromitací OS/rendereru.

### Opis interního promptu

Desktop odpověď obsahovala opis interních instrukcí a kontextu. Backend nyní odmítá alespoň 20 souvislých normalizovaných slov z aktuálního pravidlového promptu, včetně varianty Jsi/Jsem Máša. Nehledá kopie běžného obsahu vaultu. Kontrola platí pro obě dokončené provider odpovědi a Ollama stream. Podezřelý úvod může krátce zadržet; po detekci zavře provider stream, nevrátí final ani návrh k provedení. UI obnoví draft a odmítnutý text nepřidá do historie.

Guard nepokrývá parafráze/kódované kopie a může odmítnout dlouhou legitimní citaci interních pravidel. Při opisu po jiném úvodu může být část textu dočasně vidět. Není to autorizační hranice; systémový prompt nesmí být úložiště secretů. Žádný dodatečný modelový call či skrytý retry se nepřidává.

Důkaz: stream po malých chunkech, echo po úvodu, dokončená HTTP 502 odpověď, neprovedení akcí, zachování legitimního vysvětlení a uzavření provider iteratoru. Živý smoke přes skutečný FastAPI, ověřený Electron gateway a HTTP fixture ověřil také uzavření provider TCP/HTTP spojení před dokončením odpovědi. Skutečná šablona `masa-cyber` se v tomto prostředí netestovala.

### Souhlas se vzdáleným obrázkem

Původní boolean souhlas v `RemoteImage` přetrval při změně `src`. Nový či podvržený Markdown tak mohl využít starší kliknutí pro jiný síťový cíl. Souhlas je nyní vázaný na přesnou URL včetně query. Změna URL znovu zobrazí tlačítko; ne-HTTPS schemes se nenačítají.

Důkaz: DOM regrese schválená URL → jiná query s potenciálním obsahem note → žádný obrázek před novým kliknutím. Potvrzená URL se stále odešle cílovému serveru; aplikace nevydává souhlas s jednou URL za souhlas se všemi dalšími.

## CI a GitHub Device OAuth

Workflow nyní používá Node 24 místo nekompatibilního Node 20; deklarované minimum Forge toolchainu je >=22.13.0 v package manifestu/locku. Frontend/desktop + build a Python 3.12 backend mají matice Ubuntu 24.04/Windows 2022. Pinned Ubuntu verze odstraní neplánovaný přechod `ubuntu-latest`; PowerShell helper se v Actions při chybějícím runtime nesmí přeskočit. Checkout nemá persistentní credentials, `GITHUB_TOKEN` má jen `contents: read`, Actions jsou připnuté na ověřené plné commit SHA a caches používají konkrétní lockfiles. Běh nepublikuje release ani nepoužívá produkční secrets.

Ověření CI není přebarvené přes `continue-on-error` ani vypnuté testy. Historickou překážkou byl GitHub billing lock před přidělením runneru; nynější základ má úspěšný hosted běh. Standardní hosted runnery veřejného repozitáře jsou [zdarma](https://docs.github.com/en/billing/concepts/product-billing/github-actions), účet ale může zůstat blokovaný i pro jejich použití. Chybu účtu nelze odstranit změnou Node nebo testů v repozitáři. Po odstranění blokace: Actions → poslední CI → Re-run failed jobs. Frontend/backend výsledky Windows jsou doložené výše uvedeným během; test instalace aplikace je samostatný krok.

V Device OAuth byl token dříve uložený před ověřením účtu a odpojení nezneplatnilo pending flow. Main nyní vlastní jedinou přihlašovací operaci, kontroluje TTL/poll interval a sdílí in-flight request. Cancel/disconnect/reload/window close abortuje požadavky a opožděné výsledky odmítá. Zápis credentialu sdílí frontu s odpojením; cancel během zápisu obnoví předchozí token. Starší HTTP 401 nesmaže novější credential.

Sdílený zabudovaný OAuth Client ID byl odstraněný. Vlastní ID a povolený Device Flow jsou explicitní konfigurace; fine-grained PAT zůstává dostupný bez OAuth konfigurace. Výchozí `public_repo` je užší než předchozí `repo read:user`, přístup k private repo vyžaduje výslovnou volbu. Nativní dialog potvrzuje Client ID/scope, druhý zobrazuje skutečný GitHub kód před otevřením pevné HTTPS URL a další potvrzuje ověřený účet před uložením. Scopes z token grant odpovědi i `/user` hlavičky musí být podmnožinou schválených oprávnění. Žádné cizí endpointy, redirecty, raw provider errors, token ani `device_code` se do workspace nepředávají. Privilegované IPC odmítá i same-origin subframe.

Důkaz: `github-auth-runtime.test.cjs` včetně late response, expiry, slow_down, broader scopes, neplatného účtu, souběžného startu, cancel během persistence a disconnect. `github-auth-ipc.test.cjs` provede skutečný preload → main handler → auth runtime → fixture GitHub odpovědi → nativní dialog callback → secret store a zpětné disconnect. Test používá Electron/HTTP/storage fixtures; nenahrazuje živý OAuth grant nebo skutečný Electron GUI. React regrese ověřují výchozí/explicitní scope, cancel polling timeru a ignorování opožděného výsledku po unmountu.

Ochrana neblokuje autorizaci útočníkovy aplikace mimo Ethical World na skutečné GitHub stránce. Client ID není secret ani důkaz důvěryhodného vlastníka. Dříve uložené tokeny/grants se automaticky nezúží; odpojení odstraní lokální credential, vzdálený grant se revokuje v GitHub Settings → Applications. `public_repo` i `repo` stále dovolují více než Markdown/Contents; další omezení poskytuje fine-grained PAT nebo GitHub App.

## Backend, launcher a odezva

`backend-manager.cjs` sdílí souběžný start, ověřuje identitu, podporuje retry po chybě a restart vlastního ukončeného procesu. Bundled cold start má 45s limit, dev 15s. Okno se otevře bez čekání na backend; panel, retry a zpráva se připojí ke stejné přípravě. Již odeslaný POST se automaticky neopakuje. Neověřený backend se nepřebírá a ukončuje se pouze vlastně spuštěný proces. Existující podporovanou Ollamu aplikace využije, ale nepřebírá její životní cyklus ani ji při zavření neukončuje.

Foreground příprava modelu spustí Ollamu a zkontroluje přesný nainstalovaný model bez prázdné generate warmup operace před chatem. Neprovádí download nebo automatickou výměnu modelu. Startup diagnostika je omezená a rediguje capability/známé secret hodnoty; neukládá chat/vault obsah.

Git launcher používá čistý checkout, fast-forward aktualizaci, časový limit kontroly a instalační receipt. Nezměněný commit nebalí znovu. Dirty/divergent checkout zachová, při offline fetch nebo neúspěšném buildu použije předchozí instalaci, pokud existuje. Chyba ani neověřená instalace neoznačí commit za nainstalovaný. Zamykání balení a opravy shortcut discovery/PowerShell 5.1 jsou součástí kódu a helper regresí; Squirrel/native Windows flow zůstává k retestu.

Dvě doložená desktop měření z konverzace:

| Metrika | Starší odpověď | Pozdější odpověď |
| --- | --- | --- |
| První viditelný text od submitu | 48,12 s | 1,08 s |
| Příprava služeb | Neměřeno | 0,39 s |
| Load / prompt modelu | 11,59 / 10,72 s | 0,02 / 0,10 s |
| Round trip / výstupní tokeny | 48,75 s / 18 | 26,88 s / 768 |
| Rychlost generování providera | 28,5 tok/s | 29,8 tok/s |

Pozdější model využil připravené váhy, ale generoval chybný dlouhý výpis instrukcí. Nejde o párový benchmark stejného zadání a studeného stavu; nelze z něj počítat obecné procentuální zrychlení ani správnost odpovědí. Poslední ochrana promptu potřebuje vlastní desktop retest.

## Otevřená rizika a další práce

| Priorita | Zbývající problém | Konkrétní další krok |
| --- | --- | --- |
| P1: ověření distribuované aplikace | Lokální regrese a HTTP smoke nenahrazují packaged Windows renderer E2E | Launcher update, dva starty, backend restart, owner/session flow, chat/stream/stop, navigace/IPC, junction a save při zavření |
| P1: konkrétní LLM a nepřímá injection | Model může stále následovat podvržený text a navrhnout chybný obsah; zápis s kontextem chrání potvrzení | Reálný `masa-cyber` corpus: benigní české dotazy, falešné role/souhlasy v note/metadatech/historii, kódování/parafráze; měřit kvalitu i false positives guardu |
| P1: lokální data nejsou izolované podle účtu | IndexedDB vault sdílí profil; logout není šifrované uzamčení poznámek | Navrhnout per-account datové oddělení/lock, obnovu a migraci; oddělit tento požadavek od runtime capability |
| P2: Notion key storage a export race | Klíč je v datovém adresáři, kontrola obsahu před replace není atomická | OS key store; explicitní diff/backup a dokumentovaná conflict policy |
| P2: supply chain a build prostředí | Runtime locks existují, PyInstaller build požadavky nejsou úplně uzamčené; advisory stav se průběžně mění | Uzamknout build toolchain, Python hashes; pravidelně opakovat npm/pip advisory audit |
| P1: historická hosted CI blokace | Uzavřeno pro základ `0403da0`; čtyři úspěšné joby | Každý další commit ověřovat jeho vlastním CI během |
| P2: velký vault a export UX | Graph pořád porovnává všechny páry; chybí jednotný export preview a atomicita batchu | 100/500/1000-note benchmark, worker/top-K; create/update/conflict manifest a zřetelný partial success |
| P2: GitHub connector scope | Default je `public_repo`, private `repo` je explicitní; obě oprávnění stále přesahují Contents/Markdown | Fine-grained PAT pro vybraná repa nebo GitHub App/minimální Contents permissions; retest živého OAuth a odebrání starých grantů |
| P3: přesnost názvů a dlouhodobá důvěra | Bootstrap admin je běžný účet; Carrot týmová rotace/enrollment nejsou hotové | Srovnat názvy s rolemi; navrhnout explicitní trusted-key lifecycle a jeho regrese |

## Doložená validace

Závěrečná lokální kontrola CI/OAuth oprav: **201 úspěšných unikátních testů**, TypeScript a produkční Vite build; žádný test nebyl přeskočený.

| Vrstva | Výsledek | Praktický rozsah |
| --- | --- | --- |
| Vitest | 97 prošlo | App/IndexedDB, chat transport, návrhy/approval, scope, streaming/draft, Carrot, graph, obrázky |
| Node / Electron helpers | 60 prošlo, 0 skip; včetně PowerShell helperu s portable PS 7.4.7 | OAuth controller + preload/main IPC, frame policy, runtime identity/lifecycle, secrets/signer, Markdown export, launcher a PowerShell shortcut/cwd regrese |
| Python backend | 44 prošlo v úplném závěrečném běhu | Capability/auth, provider URL/DNS/stream, context budgets/complete IDs, echo/role boundaries, parent EOF, SQLite connection cleanup |
| Živý HTTP smoke | Prošel při předchozí Máša opravě; tento krok ho neopakuje | Skutečný FastAPI proces + ověřený desktop gateway + fixture provider: start, stream, hostile context separation, echo rejection/connection close, restart, EOF shutdown |

Lokální prostředí: Linux, Node 24.19.0, Python 3.12.14, portable PowerShell 7.4.7. Skutečný Electron Windows renderer, Windows PowerShell 5.1, Squirrel upgrade, Ollama modelové váhy/GPU a živé GitHub/Notion OAuth exporty tímto během ověřené nejsou. Dříve zapsaný npm/pip advisory scan v dev notes není nový scan k této CI/OAuth aktualizaci. Workflow YAML, matice, oprávnění a plné SHA byly zkontrolované lokálně; actionlint nebyl spuštěný, protože download release binárky nebyl v tomto prostředí dostupný.

Změny CI/OAuth se ověřují cílenými regresními testy, celou lokální sadou, strukturální kontrolou workflow YAML, vazbami nálezů na zdrojové soubory a `git diff --check`. Hosted výsledek je samostatné ověření; billing lock nelze vydávat za úspěšnou CI validaci. Podrobnosti implementace a jednotlivých ověření jsou v [DEV-NOTES.md](DEV-NOTES.md), hranice důvěry v [SECURITY.md](SECURITY.md) a chování agentky v [AI.md](AI.md).

## Doporučený další retest

1. Windows: aktualizace přes launcher a dva běžné starty; bez nového commitu se znovu nebalí. Ověřit výpadek/restart backendu a uchování původní instalace při neúspěšném updatu.
2. Máša: dva krátké stejné dotazy pro cold/warm odezvu, potom dokument a navazující editace. Zaznamenat preparation, first token/text, load/prompt/generation, tokeny, `ollama ps` a kvalitu obsahu.
3. Injection: podvržené instrukce v těle, title/folder/indexu a starší odpovědi. READ nesmí měnit data; ASSIST i AGENT s kontextem musí ukázat konkrétní návrh k potvrzení. Opis nesmí skončit uloženou odpovědí/akcí.
4. Preview/data: změna dříve schválené image URL, externí odkaz, Mermaid error, junction export, konflikt GitHub/Notion a zavření během ukládání.
5. GitHub: vlastní OAuth aplikace, public/private volba, odmítnutí širšího grantu, native kód/account potvrzení, cancel/disconnect při pomalé odpovědi a revokace starého grantu; pro další změny ověřit nový CI běh na obou OS.
6. Rozšířit cílené regrese o auth cooldown recovery, OAuth state limit, Carrot key lifecycle a fuzz/property případy parseru/paths. Výsledky zaznamenat po scénářích; žádný hand-picked corpus neoznačovat za stoprocentní odolnost.
