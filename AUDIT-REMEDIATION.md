# Opravy hloubkového auditu

Základ: `dev/first-runnable`, commit `0403da0382cf8e4d4a7bb50b2eb02e9020b4b96e`. Práce navazuje na druhý audit z 7. 10. 2026. Nálezy označené EW jsou opravené v kódu a ověřené regresními testy; nativní instalace Windows a skutečný lokální model mají samostatné ověřovací hranice.

| Nález | Oprava | Regresní důkaz |
|---|---|---|
| EW-01: pozdní import přepíše uložený edit | Snapshot při zahájení importu, aktuální refs, porovnání a zápis v jedné IndexedDB transakci; konflikt při editaci, smazání nebo změně jiné karty; uživatelské title/folder zůstávají zachované | Skutečný App + ConnectorPanel + IndexedDB: pomalé čtení → edit → návrat importu; transakční test stejných timestamps a změny jiné karty |
| EW-02: zkrácený Notion import nahradí úplnou poznámku | Neúplný výstup nesmí přepsat úplnou note; nové neúplné notes mají source.incomplete a AI complete=false; neúplná Notion note nesmí do full-page exportu | UI/IndexedDB reimport + kontrola skutečného AI payloadu |
| EW-03: web stream se bufferuje a má krátký timeout | Ověřený stream se přenáší jako NDJSON přes pipeline s backpressure, 250s timeoutem, limitem a odpojením upstream při cancel | Skutečný Vite server + HMAC backend: start dorazí před final; abort zavře upstream |
| EW-04: Stop nezruší běžný desktop IPC požadavek | Identifikátor požadavku, AbortController v main, cancel IPC, okamžité odmítnutí promise v rendereru; cleanup při navigaci a ukončení | Nevyřízené IPC okamžitě vrací AbortError; skutečný HTTP provider dostane odpojení |
| EW-05: Notion OAuth dokončení po disconnect obnoví token | Generace autorizace a zámek při uložení/odpojení, invalidace čekajících state i již běžící výměny; nový login nahrazuje starý | Async testy pending state, pozdní token exchange a nahrazení loginu |
| EW-06: Carrot head se určuje timestampem | Topologická hlava podle parentId/hash, čas pouze informační; kontrola head a vložení v jedné IDB transakci; dávkové ověření bez rekurze | Tři podpisy v jedné ms a posun hodin zpět, skutečný signer + IDB; odmítnutí forků/cyklů |
| EW-07: prázdná historie neověří checkpoint | Ověření head i pro prázdnou historii s noteId; UI rozlišuje chybějící důvěryhodnou historii a dosud nevytvořené commity | Neprázdný OS checkpoint + prázdné IDB history vrací chybu |
| EW-08: export neaktualizuje klientský baseline | Receipt se přesným snapshotem pro local/GitHub/Notion; novější edit zůstává lokálně změněný; local partial batch vrací úspěšné cesty a chybu | App: export snapshotu → novější edit → dokončení; baseline=odeslaný obsah, content=novější edit |
| EW-09: SW klonuje až po spotřebování response | Clone vznikne před vrácením response a otevřením cache; chyby cache neblokují online výsledek | VM service worker: klient spotřebuje response před dokončením cache.open; uložené tělo zůstane úplné |
| EW-10: společný tag vytvoří kvadratickou kliku | Invertovaný index, ignorování širokých postings/tagů, 128 kandidátů/note, top 6, max 8 souvisejících hran/note a 6 000 celkem; výpočet ve workeru, starý worker se ukončí | 2 000 notes se společným tagem: 0 related hran, konkrétní wiki link zachovaný |
| EW-11: local cesty lišící se velikostí písmen kolidují | Ambivalentní cesty se odmítnou před importem; neproběhne žádný částečný zápis | A.md + a.md vede k explicitní chybě místo sdíleného ID |

## Přidané funkce a související zpevnění

- Web Research používá skutečný Crawlee BasicCrawler od Apify, lokální frontu, opakování, průběh, cancel, náhled, restart a explicitní import. Pravidla URL/DNS, IP pinning, robots.txt, limity, inertní HTML parser a časové omezení chrání nový síťový vstup. Regrese používá skutečný Crawlee runner s řízenými odpověďmi.
- Atribuce je viditelná v konektoru, README a THIRD_PARTY_NOTICES.md; plná Apache 2.0 licence je v distribuci. Projekt nepředstírá partnerství s Apify.
- ICO je reprodukovatelně odvozené ze stávajícího SVG. Zapojené jsou aplikace, tokenové okno, backend EXE, Squirrel Setup a launcher. Regrese kontroluje všech sedm ICO snímků. Windows CI sestaví binárky a porovná jejich skutečné ikony; instalační retest na uživatelském PC zůstává samostatný.
- Desktopový Notion master key se migruje do OS secure storage. Původní klíč se zachová a plaintext se odstraní až po read-back; chyba uložení nechá původní klíč na místě. Backend nedostává klíč přes renderer nebo IPC.
- PyInstaller a jeho build dependencies jsou přesně připnuté. CI má nový Windows packaging job a instalační ZIP/Setup artifact.
- README a AUDIT už nerozporují doložený úspěšný CI běh původního základu.

## Rozsah ověření a zbývající hranice

Spouští se `npm run verify`, `python -m server.test_runner`, dependency advisory kontroly a reálný HTTP gateway test. Lokálně prošlo 109 frontend testů, 71 Electron/Node testů a 46 backend testů (226 celkem). Jeden další test zástupců vyžaduje PowerShell a na Linuxu je přeskočený. Kontrola ikon porovnává všech sedm resource přímo v zabalených EXE; regrese odmítne skutečný placeholder, chybějící velikost i změněný obrazový bajt. npm i pip-audit runtime/build dependencies hlásí nula známých zranitelností. Živý HTTPS smoke test v tomto prostředí narazil na DNS chybu `EAI_AGAIN`; skutečný Crawlee runner byl ověřen s řízeným síťovým vstupem. Hosted výsledky jsou uvedené v PR; žádný výsledek starého commitu se nepřenáší na nový commit.

Naměřený syntetický tagový graf (2 000 notes, přibližně 6 000 znaků/note) klesl z 1 999 000 hran a přibližně 5 431 ms na 0 related hran a 74 ms. První chunk HTTP streamu při fixture odpovědi trvající 1 s dorazil přibližně za 10 ms. Jde o měření tohoto prostředí, ne benchmark uživatelského PC.

Na Linuxu nelze vykonat Windows instalaci, test zástupců ani ověřit uživatelovu cache ikon. Windows package a kontrola binárek jsou proto samostatný CI job. Certifikát pro podpis Windows aplikace není součástí repozitáře; Authenticode podpis a SmartScreen reputaci tento PR nepředstírá.

Skutečný Ollama model/GPU a živý OAuth účet nejsou v tomto prostředí k dispozici. Charakterové AI budgets a pravidlo, že neúplný kontext nesmí nahradit celou poznámku, zůstávají zachované. Modelová kvalita ani odolnost proti všem prompt injections nejsou garantované.

Notion API neposkytuje atomický read/replace: baseline kontrola nemůže zabránit každé souběžné editaci mezi vzdáleným čtením a zápisem. Local batch má preflight a zálohy, ale není atomický přes všechny soubory; partial receipts uvádějí skutečně úspěšné zápisy. Vault zůstává společný pro profil zařízení, logout není kryptografický zámek vaultu. Samostatný Python backend musí používat bezpečně poskytnutý master key. Python lock má přesné verze, ale nepoužívá hash enforcement.
