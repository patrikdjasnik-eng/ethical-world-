# Ethical World

![Status](https://img.shields.io/badge/status-v0.1_MVP-6f42c1)
![React](https://img.shields.io/badge/React-TypeScript-149eca)
![AI](https://img.shields.io/badge/AI-local--first-111827)
![Storage](https://img.shields.io/badge/storage-IndexedDB-f59e0b)

Ethical World je local-first knowledge workspace inspirovaný nástroji jako Obsidian, ale AI vrstva je součástí architektury od prvního dne.

> **CI:** Poslední ověřený běh původního základu `0403da0` je [37660876897](https://github.com/patrikdjasnik-eng/ethical-world-/actions/runs/37660876897): frontend i backend prošly na Ubuntu 24.04 a Windows 2022. Stav konkrétních nových změn ověřuj v jejich PR.
>
> Opravy druhého hloubkového auditu: [AUDIT-REMEDIATION.md](AUDIT-REMEDIATION.md). Windows CI navíc balí aplikaci a kontroluje skutečné ikony EXE a instalátoru.

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

## Instalace na vlastním PC

Windows instalátor a launcher jsou určené pro **Windows x64**. Linux a macOS mohou používat webovou vývojovou variantu popsanou níže. Repozitář je **veřejný**: kdokoliv ho může naklonovat přes HTTPS a používat Git aktualizace bez přihlášení ke GitHubu.

### 1. Připrav nástroje

| Nástroj | Co nainstalovat |
| --- | --- |
| Windows | Windows 10/11, 64bitová varianta; aktuální Ollama vyžaduje alespoň Windows 10 22H2. |
| Git | [Git for Windows](https://git-scm.com/install/windows). Pro veřejné HTTPS klonování není potřeba GitHub účet ani token. |
| Node.js + npm | [Node.js 24 LTS](https://nodejs.org/en/download). Současný desktop toolchain vyžaduje minimálně Node 22.13. |
| Python | [Python pro Windows](https://www.python.org/downloads/windows/). Backend je lokálně ověřený s Pythonem 3.12; zajisti funkční příkaz `python` v PATH. |
| Ollama | [Ollama pro Windows](https://ollama.com/download/windows), pokud chceš lokální AI. Poznámky a graf lze používat i bez ní. |

Po instalaci nástrojů otevři nový **PowerShell** a zkontroluj jejich dostupnost:

```powershell
git --version
node --version
npm.cmd --version
python --version
```

První sestavení vyžaduje internet pro stažení závislostí. Pro lokální AI počítej také s místem na model, RAM/VRAM a odpovídajícím výkonem počítače. Ollama ani modelové váhy nejsou součástí instalátoru Ethical World.

### 2. Naklonuj projekt a vytvoř launcher

Následující příkazy vytvoří checkout v tvém profilu. Pokud ho chceš jinde, uprav první `Set-Location`. Veřejná HTTPS adresa nevyžaduje přihlášení.

```powershell
Set-Location $env:USERPROFILE
git clone --branch dev/first-runnable https://github.com/patrikdjasnik-eng/ethical-world-.git
if ($LASTEXITCODE -ne 0) { throw "Klonovani selhalo. Zkontroluj sit, adresu a cilovou slozku." }
Set-Location .\ethical-world-
npm.cmd run desktop:launcher:install
if ($LASTEXITCODE -ne 0) { throw "Instalace launcheru selhala." }
```

Použij plný Git clone. ZIP stažený z GitHubu ani shallow clone s `--depth` neobsahují historii potřebnou pro verzování a aktualizace launcheru. Funguje také SSH origin s předem nastaveným GitHub SSH klíčem; token nevkládej do clone URL.

### 3. Spusť první instalaci

Otevři novou ikonu **Ethical World Launcher** na ploše nebo v nabídce Start. Na novém PC launcher:

1. Ověří větev, čistý checkout a přístup k Gitu.
2. Nainstaluje npm závislosti a vytvoří Python prostředí `.venv`.
3. Spustí lokální frontend, desktop a backend testy a sestaví aplikaci.
4. Zabalí vlastní FastAPI backend a vytvoří Windows instalátor.
5. Nainstaluje Ethical World, ověří instalaci a otevře aplikaci.

První instalace může trvat několik minut; průběh je v okně launcheru. CI/CD, veřejné Releases ani placený GitHub plán nejsou potřeba. Při prvním otevření nastav vlastní heslo lokálního owner účtu, alespoň 12 znaků. Tento účet je oddělený od přihlášení ke GitHubu.

Checkout ponech na stejném místě: launcher ho používá i pro další aktualizace. Pro běžné spouštění používej **Ethical World Launcher**; přímá ikona **Ethical World** otevře instalaci bez Git kontroly.

### 4. Připrav lokální model Máši

Po instalaci Ollamy otevři nový PowerShell. Pro první vyzkoušení lze stáhnout veřejný model [qwen2.5:7b](https://ollama.com/library/qwen2.5:7b):

```powershell
ollama --version
ollama pull qwen2.5:7b
if ($LASTEXITCODE -ne 0) { throw "Stazeni modelu selhalo." }
ollama list
```

V nastavení Máši vyber **Ollama**, Base URL `http://127.0.0.1:11434` a přesný nainstalovaný model, například `qwen2.5:7b`. Výchozí alias `masa-cyber:latest` je vlastní lokální model; nový počítač ho automaticky nemá. Můžeš vybrat libovolný již nainstalovaný podporovaný chatový model z výpisu `ollama list`.

Desktop spouští FastAPI backend sám. Máša připraví lokální Ollamu nebo využije již běžící službu; vybraný model přednačte na pozadí po odemčení aplikace. Panel ukazuje stav přednačtení; zprávu lze odeslat i během něj. První zpráva může stále čekat na fyzické načtení modelu, pokud přednačtení ještě neskončilo. Ruční `uvicorn` vedle desktopu není potřeba. Pokud příprava selže, panel ukáže chybu a tlačítko **Zkontrolovat znovu** provede nový pokus. Modely se samy nestahují.

### Skutečné poznámky vytvořené Mášou

V ASSIST zadej například „Vytvoř Markdown poznámku o malware ve složce Cybersecurity“. Ollama vrátí strukturovaný návrh. Obsah se zobrazí pod **Navržené akce → Náhled změny**, místo samotného dokumentu v chatu. Tlačítko **Použít** zapíše poznámku do lokálního vaultu; **Použít vše** provede navržené složky před jejich poznámkami. Potvrzení úspěchu vzniká až po dokončeném zápisu. Poznámka se otevře v editoru a zůstává uložená po restartu.

Pro doplnění otevři cílovou poznámku a požádej například „Doplň tuto poznámku o detekci“. Přepis vyžaduje úplný obsah cíle a nezměněný původní stav; při konfliktu připrav nový návrh. Neplatný, neúplný nebo tokenovým limitem ukončený návrh se neprovede. READ změny nepovoluje; AGENT zachovává omezený grant pro nové poznámky a jinak vyžaduje potvrzení. Obsah a faktickou správnost před potvrzením zkontroluj.

Strukturované návrhy používají lokální Ollama JSON schema API; OpenAI-compatible provider nadále používá dosavadní protokol návrhů. Žádné modelové váhy se automaticky nestahují. Poznámka ve vaultu není automatický export `.md` na disk; k tomu slouží Markdown konektor.


### Další aktualizace

Zavři Ethical World a znovu otevři **Ethical World Launcher**. Nový commit stáhne a sestaví pouze po lokálních kontrolách; stejný již nainstalovaný commit znovu nebalí. Lokální změny nebo vlastní commity automatický update zastaví a zachovají checkout. Pokud je aplikace při kliknutí již otevřená, launcher ji zaměří a aktualizace počká na příští start.

Ruční sestavení a instalaci lze v zavřeném desktopu spustit z kořene checkoutu:

```powershell
git pull --ff-only origin dev/first-runnable
if ($LASTEXITCODE -ne 0) { throw "Git pull selhal." }
npm.cmd run desktop:update
if ($LASTEXITCODE -ne 0) { throw "Desktop update selhal." }
```

Podrobnosti, umístění logů a řešení chyb jsou v [DESKTOP.md](DESKTOP.md).

## Spuštění ze zdrojů pro vývoj

### Desktop na Windows

Po klonování, v kořeni projektu:

```powershell
npm.cmd ci
if ($LASTEXITCODE -ne 0) { throw "npm ci selhalo." }
python -m venv .venv
if ($LASTEXITCODE -ne 0) { throw "Vytvoreni Python prostredi selhalo." }
.\.venv\Scripts\python.exe -m pip install -r server\requirements.lock.txt
if ($LASTEXITCODE -ne 0) { throw "Instalace backend zavislosti selhala." }
npm.cmd run desktop:dev
```

Tento příkaz otevře vývojové Electron okno a spustí vlastní backend. Nainstalovaný desktop nech zavřený, aby byl port 8787 volný. Pro změnu nainstalovaného EXE použij launcher nebo `desktop:update`.

### Web na Windows

Připrav `npm ci`, `.venv` a Python závislosti podle předchozího bloku. Potom v prvním PowerShell okně z kořene projektu spusť backend:

```powershell
.\.venv\Scripts\python.exe -m uvicorn server.main:app --host 127.0.0.1 --port 8787
```

Ve druhém okně, také v kořeni projektu:

```powershell
npm.cmd run dev -- --host 127.0.0.1
```

Otevři `http://127.0.0.1:5173`. API běží na `http://127.0.0.1:8787`; Vite jej zpřístupní přes ověřenou lokální proxy. Používej stejnou adresu prohlížeče i nadále, protože vault je uložený pro konkrétní origin. Backend i frontend musí používat stejný profil zařízení; během webového vývoje nech desktop zavřený. Ollamu ve webové variantě spouštěj samostatně, například `ollama serve`, pokud již neběží.

### Web na Linuxu nebo macOS

Použij stejnou veřejnou HTTPS adresu a větev, Node.js a Python 3.12. V terminálu připrav závislosti a spusť backend:

```bash
git clone --branch dev/first-runnable https://github.com/patrikdjasnik-eng/ethical-world-.git
cd ethical-world-
npm ci
python3 -m venv .venv
.venv/bin/python -m pip install -r server/requirements.lock.txt
.venv/bin/python -m uvicorn server.main:app --host 127.0.0.1 --port 8787
```

Ve druhém terminálu z kořene checkoutu spusť `npm run dev -- --host 127.0.0.1` a otevři `http://127.0.0.1:5173`. Modelový server běží samostatně. Windows launcher a Squirrel instalátor touto cestou nepoužívej.

### Lokální kontrola projektu

Windows, z kořene připraveného checkoutu:

```powershell
npm.cmd run verify
if ($LASTEXITCODE -ne 0) { throw "Frontend, desktop testy nebo build selhaly." }
.\.venv\Scripts\python.exe -m server.test_runner
if ($LASTEXITCODE -ne 0) { throw "Backend testy selhaly." }
```

Na Linuxu/macOS použij `npm run verify` a `.venv/bin/python -m server.test_runner`. Úplný Python test log vzniká v `out/diagnostics/backend-tests.log`. Pro vlastní `llama-server` nastav OpenAI-compatible provider a jeho `/v1` endpoint; desktop ho automaticky nespouští.

## CI a GitHub připojení

[CI workflow](https://github.com/patrikdjasnik-eng/ethical-world-/actions/workflows/ci.yml) spouští stejné frontend/desktop testy a produkční build na Ubuntu 24.04 a Windows 2022 s Node 24. Backend na obou platformách používá Python 3.12, runtime lock a `server.test_runner`. Windows větev zahrnuje skutečný PowerShell helper test; v Actions se při chybějícím PowerShellu nepřeskakuje. Workflow nic nepublikuje a nepoužívá produkční secrets. `npm run desktop:update` zůstává dostupné nezávisle na Actions.

Pokud workflow selže bez spuštěných kroků a anotace hlásí **account is locked due to a billing issue**, zkontroluj [GitHub Settings → Billing and licensing](https://github.com/settings/billing). Jde o blokaci účtu před přidělením runneru, ne o výsledek testů. Standardní hosted runnery veřejného repozitáře jsou [zdarma](https://docs.github.com/en/billing/concepts/product-billing/github-actions); větší runnery a storage mají vlastní účtování. Po odstranění blokace v Actions použij **Re-run failed jobs**.

Git clone a launcher nevyžadují přihlášení do GitHub konektoru. Pro Markdown sync lze použít **Připojit tokenem** a fine-grained PAT omezený na vybraná repa. Device OAuth vyžaduje vlastní OAuth aplikaci a `ETHICAL_GITHUB_CLIENT_ID`; výchozí scope je pouze pro veřejné repozitáře, soukromé vyžadují výslovnou volbu. Postup a ochrany přihlášení jsou v [DESKTOP.md](DESKTOP.md#github-přihlášení-v-konektoru) a [SECURITY.md](SECURITY.md).

## Dokumentace

- [ARCHITECTURE.md](ARCHITECTURE.md) – technická architektura.
- [STRUCTURE.md](STRUCTURE.md) – struktura repozitáře.
- [DESKTOP.md](DESKTOP.md) – Windows instalátor, launcher, aktualizace a diagnostika.
- [AI.md](AI.md) – AI agent, providery a kontext.
- [SECURITY.md](SECURITY.md) – bezpečnostní model.
- [AUDIT.md](AUDIT.md) – poslední hluboký bug/security audit a test plan.
- [ROADMAP.md](ROADMAP.md) – plán dalších verzí.
- [DEV-NOTES.md](DEV-NOTES.md) – průběžný vývojový deník.
- [CONTRIBUTING.md](CONTRIBUTING.md) – pravidla vývoje.

## Princip projektu

Poznámky jsou data uživatele. AI je pomocná vrstva nad nimi, ne vlastník dat. Destruktivní agentní operace budou vždy navržené tak, aby měly preview, diff nebo explicitní potvrzení.

Webový vývoj používá Vite `/api` proxy do ověřeného lokálního backendu. Backend a Vite musí mít stejný `ETHICAL_WORLD_DATA_DIR` (výchozí `~/.ethical-world`). Desktop spouští vlastní backend a komunikuje přes omezené IPC; samostatný backend před spuštěním desktopu zastav.


## Web Research a poděkování Apify

Desktopový konektor **Web Research** používá [Crawlee od Apify](https://github.com/apify/crawlee) (Apache 2.0). Děkujeme Apify za jejich open-source práci. Fronta, průběh, opakování a výsledky úloh jsou inspirované také Apify Actors; aplikace běží lokálně a nepotřebuje Apify účet ani cloudový token. [Licence a přehled atribuce](THIRD_PARTY_NOTICES.md) jsou součástí distribuce.

V Connectors zadej 1–10 veřejných HTTPS adres. Úloha má omezenou souběžnost, nejvýše dvě opakování a uložený průběh. **Výsledky** nejdřív zobrazí získaný text a zdroje; teprve **Importovat výsledky do vaultu** vytvoří poznámky. Úlohu lze zastavit, spustit znovu nebo smazat. Rozběhnuté úlohy po restartu zůstanou označené jako přerušené a samy neobnoví síťový provoz. Ukládá se nejvýše 20 úloh.

Sběr respektuje robots.txt, používá identifikovatelný User-Agent a nepoužívá přihlášení, cookies ani obcházení ochrany webu. Stahuje pouze HTML/text ze zadaných adres, bez spouštění skriptů a automatického procházení odkazů. DNS a každý redirect procházejí kontrolou veřejné adresy; adresa je připnutá k socketu. Limit je 2 MiB na odpověď, 100 000 znaků extrahovaného textu na stránku a 1 MiB výsledného textu na úlohu. Zkrácené výsledky se předávají AI jako neúplné. JavaScriptové a placené stránky mohou vyžadovat ruční import.
Politika robots.txt je záměrně přísnější než RFC 9309: HTTP 200 se vyhodnotí podle pravidel, HTTP 404 znamená chybějící pravidla. Jakýkoli jiný stav (včetně 401, 403, 429 a 5xx), síťová chyba nebo timeout sběr zastaví. Nepoužíváme obecné povolení pro všechny 4xx. Weby s nedostupnými pravidly lze zpracovat ručním importem. Při chybě připojení se vyzkouší další veřejná adresa z ověřeného DNS snapshotu; chyby TLS, HTTP a čtení těla tento fallback nespouštějí.


## Ikony desktopové aplikace

Kanonický motiv je `public/ethical-world-mark.svg`. `npm run icons:generate` z něj vytvoří ICO se sedmi velikostmi (16–256 px) a PNG. Forge používá tuto ikonu pro `EthicalWorld.exe` i `EthicalWorldSetup.exe`, backend má stejnou ikonu a launcher ji kopíruje přímo ze zdrojů místo extrakce staré placeholder ikony. `scripts/test-desktop-icons.ps1` spouští kontrolu všech sedmi ikonových resource přímo v aplikačním EXE, instalátoru a zabaleném backendu; porovnává jejich bajty s kanonickým ICO bez převodu a škálování přes Windows Shell. Novou ikonu uvidíš po sestavení a instalaci aktualizované verze.

Desktop ukládá Notion master key přes OS secure storage. Existující `connector.key` migruje beze změny klíče a plaintext odstraní až po ověřeném uložení. Samostatně spuštěný Python backend nadále potřebuje bezpečně dodaný `ETHICAL_WORLD_CONNECTOR_KEY`; po desktopové migraci nenechávej samostatný backend vygenerovat jiný klíč pro tutéž databázi.


### Postavička Máši

Máša má v pravém dolním rohu žraločí postavičku. Kliknutím otevřeš chat; po minimalizaci uvidíš její aktuální stav práce. Tlačítkem **Pet** v horní liště ji můžeš skrýt nebo obnovit. Nastavení se uchovává lokálně. Pohyb respektuje systémové omezení animací a obrázek funguje i offline po instalaci aplikace. Postavička představuje stav asistenta; vlastní paměť nebo trénování modelu tímto krokem nevzniká.


### Přidání více Markdown souborů

V **Connectors → Local / VS Code workspace → Přidat Markdown soubory** vyber více `.md` nebo `.mdx` souborů pomocí Ctrl/Shift. Import vytváří nové poznámky a původní soubory nemění. Další dávka přidá další kopie; pro průběžnou synchronizaci stejného zdroje použij desktopový složkový konektor. Výběr i import složky podporuje až **100 000 souborů**, každý nejvýše **2 MiB**. U velmi velkých vaultů závisí doba importu a odezva rozhraní na velikosti obsahu a výkonu zařízení.


### Upozornění na nové registrace

Nové registrace backendu ukládají upozornění pro **rabbithollowczech@gmail.com** do SQLite fronty ve stejné transakci jako účet. E-mail obsahuje jméno, e-mail, UTC čas a ID účtu; neobsahuje heslo ani token. Odesílání běží na pozadí přes ověřené TLS, po chybě se opakuje s odstupem až jedné hodiny a neodeslaná zpráva přežije restart. SMTP bez nakonfigurovaných přihlašovacích údajů nic neodesílá; zprávy zůstávají čekat. SMTP doručení může při pádu mezi odesláním a potvrzením vytvořit duplicitu, proto má zpráva stabilní Message-ID.

Na Windows po aktualizaci aplikace zavři běžící Ethical World a z kořene repozitáře spusť:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-with-registration-mail.ps1
```

Skript vyžádá přihlašovací údaje odesílající schránky včetně [hesla aplikace Google](https://support.google.com/accounts/answer/185833); heslo nezapisuje na disk ani do příkazové historie a předá ho spuštěnému backendu přes prostředí procesu. Při dalším spuštění je zadáš znovu. Parametr `-Dev` místo nainstalovaného launcheru spustí vývojovou aplikaci.

Pro spravovaný server nastav `ETHICAL_WORLD_SMTP_HOST`, `ETHICAL_WORLD_SMTP_PORT` (465 pro implicitní TLS, jinak STARTTLS), `ETHICAL_WORLD_SMTP_USER` a `ETHICAL_WORLD_SMTP_PASSWORD` jako serverové proměnné prostředí. `.env.example` slouží jako přehled; backend soubor `.env` automaticky nenačítá. Přihlašovací údaje nevkládej do distribuovaného EXE ani do frontendu.

Účty jsou zatím lokální: upozornění zahrnují jen registrace backendu s nastaveným SMTP. Pro přehled registrací ze všech instalací je potřeba společný registrační server. Doručení do skutečné schránky je třeba ověřit po nastavení SMTP; automatické testy používají náhradu poštovní služby.
