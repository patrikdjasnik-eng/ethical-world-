# Ethical World

![Status](https://img.shields.io/badge/status-v0.1_MVP-6f42c1)
![React](https://img.shields.io/badge/React-TypeScript-149eca)
![AI](https://img.shields.io/badge/AI-local--first-111827)
![Storage](https://img.shields.io/badge/storage-IndexedDB-f59e0b)

Ethical World je local-first knowledge workspace inspirovaný nástroji jako Obsidian, ale AI vrstva je součástí architektury od prvního dne.

> **Stav CI — ověřeno 7. 10. 2026:** GitHub Actions jsou blokované kvůli problému s účtováním GitHub účtu. [Ověřený běh](https://github.com/patrikdjasnik-eng/ethical-world-/actions/runs/37629754595) skončil před spuštěním testů s hláškou „The job was not started because your account is locked due to a billing issue.“
>
> Lokálně prošlo 201 testů a produkční build. Hosted CI zůstává neověřené do odstranění blokace v GitHub Billing a opakování běhu. Podrobnosti: [AUDIT.md](AUDIT.md#ci-a-github-device-oauth) a [postup pro CI](#ci-a-github-připojení).

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

Desktop spouští FastAPI backend sám. Máša připraví lokální Ollamu nebo využije již běžící službu; model načte první skutečný chat. Ruční `uvicorn` vedle desktopu není potřeba. Pokud příprava selže, panel ukáže chybu a tlačítko **Zkontrolovat znovu** provede nový pokus. Modely se samy nestahují.

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
