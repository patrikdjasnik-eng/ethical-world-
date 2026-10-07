# Desktop / EXE

![Desktop](https://img.shields.io/badge/desktop-Electron-47848F)
![Windows](https://img.shields.io/badge/target-Windows-0078D4)
![Packaging](https://img.shields.io/badge/package-Electron_Forge-111827)
![Updates](https://img.shields.io/badge/updates-GitHub_Releases-7c3aed)
![Security](https://img.shields.io/badge/contextIsolation-on-16a34a)

Ethical World má desktop shell přes Electron. React/Vite renderer zůstává společný pro web i desktop, Electron přidává nativní okno, preload bridge, native context menu, packaging a auto-update.

## Vývoj

```powershell
npm ci
npm run desktop:dev
```

Web varianta dál funguje:

```powershell
npm run dev
```

## Lokální ověření

```powershell
npm run verify
```

## Windows build

```powershell
npm run desktop:make
```

Výstup je pod `out/`.

## Auto-update

Repozitář je private. Veřejný Electron update service neumí autentizovat private Releases, proto je automatická kontrola aktualizací standardně vypnutá. Nový instalační balíček distribuujeme ručně přes přístup k private repozitáři. GitHub token nikdy nevkládáme do rendereru nebo instalátoru.

Pouze při vědomém přechodu na veřejné Releases lze zapnout `ETHICAL_WORLD_PUBLIC_UPDATES=1`. Nastavení CI/CD nebo placeného plánu není podmínkou lokálního ověření a sestavení.

Desktop na portu 8787 spouští vlastní backend s náhodnou runtime capability a ověřuje challenge proof. Obsazený port nepřebírá. Renderer používá validované IPC místo `file://` fetch/CORS. Notion OAuth callback používá výchozí port 8787; změna `ETHICAL_WORLD_DESKTOP_PORT` vyžaduje odpovídající OAuth redirect konfiguraci.

### Vydání nové patch verze

Nejdřív musí být working tree čistý.

```powershell
npm run version:patch
git push origin dev/first-runnable
git push --tags
```

Pak nastav GitHub token pouze do aktuálního PowerShell procesu:

```powershell
$env:GITHUB_TOKEN="TVUJ_GITHUB_TOKEN"
npm run desktop:publish
Remove-Item Env:GITHUB_TOKEN
```

`desktop:publish` spustí lokální testy + build, vytvoří Windows artefakty a přes Electron Forge GitHub Publisher je nahraje jako GitHub Release.

Token se nesmí commitnout do repozitáře ani zapisovat do aplikace.

Pro větší release lze místo patch použít:

```powershell
npm run version:minor
npm run version:major
```

### Důležité

Samotný `git pull` nainstalované EXE neaktualizuje. Desktop updater stahuje pouze hotové GitHub Releases s vyšší SemVer verzí. To brání tomu, aby si produkční aplikace stahovala neověřený zdrojový stav větve a pokoušela se sama přebuildovat.

Release nesmí být draft ani prerelease, pokud má být distribuován běžným stable updaterem.

## Security model

Renderer nedostává Node.js API.

```text
React renderer
  ↓
window.ethicalDesktop
  ↓
contextBridge
  ↓
preload.cjs
  ↓
Electron IPC
  ↓
main.cjs
```

`contextIsolation` je zapnuté, `nodeIntegration` vypnuté a renderer běží v sandboxu.

Squirrel.Windows startup events zpracovává `electron-squirrel-startup`, aby install/update lifecycle nespouštěl aplikaci nekorektně vícekrát.

## Native graph interaction

V Electron režimu graph používá native context menu pro pravý klik. Browser fallback používá HTML context menu.

## Další desktop krok

1. filesystem Markdown vault;
2. watcher externích změn;
3. import existujícího Obsidian vaultu;
4. native drag/drop attachments;
5. lokální AI gateway startovaná aplikací;
6. custom titlebar a tray;
7. release signing.


## Desktop shortcut

Squirrel.Windows při instalaci a update lifecycle vytváří zástupce aplikace v Start Menu a na ploše aktuálního Windows uživatele. Ethical World používá `electron-squirrel-startup` pro obsluhu těchto událostí.

Windows AppUserModelID:

```text
com.squirrel.ethical_world.EthicalWorld
```

To drží identitu shortcutu, taskbaru a Squirrel package konzistentní.

Installer má deterministický název:

```text
EthicalWorldSetup.exe
```

### Automatický instalační test

Plný test od buildu až po shortcut:

```powershell
npm run desktop:test-install
```

Test:

1. spustí `npm run desktop:make`;
2. najde `EthicalWorldSetup.exe`;
3. skutečně spustí Squirrel installer;
4. čeká na vytvoření shortcutu;
5. ověří Desktop `.lnk`;
6. přes Windows `WScript.Shell` přečte jeho target a arguments;
7. ověří, že shortcut míří na Squirrel `Update.exe` / `EthicalWorld.exe`.

Pro úplný smoke test včetně spuštění aplikace přes novou ikonu:

```powershell
npm run desktop:test-install:launch
```

Pokud už je Ethical World na PC nainstalovaný, test umí shortcut stále ověřit. Pro definitivní důkaz chování při úplně první instalaci je nejlepší test spustit na čistém Windows účtu, Windows Sandboxu nebo VM.

Pokud už installer existuje a nechceš znovu buildovat:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-desktop-install.ps1 -SkipMake -Launch
```

> Shortcut zatím používá ikonu zabudovanou v executable. Vlastní brandované `.ico` přidáme do packageru samostatně, jakmile uzamkneme finální Ethical World logo.

## Aktualizace již nainstalovaného EXE z private repozitáře

Po `git pull --ff-only origin dev/first-runnable` zavři Ethical World a spusť `npm run desktop:update` v kořeni repozitáře na Windows. Skript obnoví uzamčené závislosti, spustí lokální kontroly, nově sestaví bundled Python backend a Squirrel installer a provede upgrade stejné aplikace. Potom ověří ProductVersion nainstalovaného EXE, přítomnost backendu a spuštění přes existující desktop shortcut. Uživatelský datový adresář nemaže.

Základní verze ve zdrojích je 0.1.1. Lokální desktop build přičítá počet commitů plné Git historie k patch části verze. Nový commit tak dostane vyšší Squirrel verzi i bez ruční změny package.json; při změně major/minor verze se použije nový základ. Forge upravuje pouze metadata a staging kopii aplikace, nikoli zdrojový package.json/lockfile. Shallow clone je odmítnutý. Nejde o stažení z GitHub Releases: instalátor se sestavuje na vlastním Windows stroji a nevyžaduje veřejný repozitář, GitHub token uvnitř instalátoru ani Actions. Skript vyžaduje již dostupné Node/npm a Python; při chybě před instalací skončí bez změny nainstalovaného EXE. Git konflikty řešíme před buildem; update skript nepoužívá reset/clean ani nemění Git větve.

Pokud backend test gate selže, úplný výpis je v `out/diagnostics/backend-tests.log`. Samostatná diagnostika: `.\.venv\Scripts\python.exe -m server.test_runner`. Hlásit první `ERROR` a navazující traceback, nikoli pouze poslední PowerShell `Update stopped`. Instalátor se při této chybě ještě nespustil.

Při EBUSY v předchozím packaging výstupu updater nově balí do unikátního `out/updates/<guid>`. Instalátor používá přesnou cestu aktuálního buildu a po instalaci obnoví desktop shortcut přes nainstalované `Update.exe`, nikoli EXE ve složce out. Staré buildy můžeš uklidit až po ověření nové instalace; aktualizační skript je nemaže. Zbylé backend procesy se ukončují pouze podle konkrétního názvu a ověřené cesty tohoto projektu/instalace.

### Dokončení instalace po chybě kontrolního skriptu

Pokud make dokončil instalátor a následná kontrola spadla před `[2/4] Running installer`, není nutné opakovat build. Po stažení opravy skriptu zavři Ethical World a použij hotový instalátor z posledního pokusu:

```powershell
$setup = Get-ChildItem .\out\updates -Filter EthicalWorldSetup.exe -Recurse -File |
  Sort-Object LastWriteTimeUtc -Descending | Select-Object -First 1
if (-not $setup) { throw "Hotovy instalator nebyl nalezen. Spust npm run desktop:update." }
$packageFile = Get-ChildItem $setup.DirectoryName -Filter "ethical_world-*-full.nupkg" -File | Select-Object -First 1
$version = [regex]::Match($packageFile.Name, '^ethical_world-(\d+\.\d+\.\d+)-full\.nupkg$').Groups[1].Value
if (-not $version) { throw "Verzi hotoveho instalatoru nelze zjistit." }
& .\scripts\test-desktop-install.ps1 -SkipMake -Launch -ExpectedVersion $version -RequireBundledBackend -InstallerPath $setup.FullName
```

Tento postup předpokládá, že poslední hotový instalátor odpovídá právě dokončenému buildu. Skript po instalaci kontroluje verzi, bundled backend a spuštěné EXE. Změny aplikačního kódu provedené až po sestavení vyžadují nový build.

Regresní test PowerShell skriptů je součástí `npm run test:electron`: na Windows používá Windows PowerShell 5.1, případně PowerShell 7; jinde PowerShell 7, pokud je dostupný. Lze jej spustit i samostatně pomocí `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-desktop-scripts.ps1`. Používá dočasné fixture soubory a náhradu COM rozhraní; instalátor nespouští ani neupravuje skutečné zástupce. Cestu k instalátoru odvozuje až v těle skriptu: Windows PowerShell 5.1 nemusí naplnit `$PSScriptRoot` při vyhodnocování výchozího script parametru. Runner ověřuje výchozí cestu i explicitní `-InstallerScript`, včetně spuštění mimo kořen projektu; AST kontrola hlídá návrat této nekompatibility v parametrech desktop skriptů.

## Launcher s automatickou aktualizací z Gitu

Jednorázová aktivace v existujícím checkoutu:

```powershell
git pull --ff-only origin dev/first-runnable
if ($LASTEXITCODE -ne 0) { throw "Git pull selhal." }
npm run desktop:launcher:install
```

Na ploše a v nabídce Start vznikne **Ethical World Launcher**. Otevírá malé tmavé okno bez PowerShell konzole. Konfigurace, stabilní launcher, ikona a log jsou v `%LOCALAPPDATA%\EthicalWorldLauncher`; ikona nezávisí na dočasném out nebo konkrétní app-version složce. Zdrojový checkout musí zůstat na svém místě.

Při každém kliknutí:

1. Pokud Ethical World už běží, launcher otevře/fokusuje existující aplikaci a upgrade odloží na další start po zavření.
2. Ověří `origin` tohoto repozitáře, větev `dev/first-runnable` a čistý working tree. Používá Git Credential Manager nebo SSH agent nastavený pro Git na PC; token konektoru uvnitř aplikace s tímto přístupem nesdílí.
3. Provede fetch a pouze fast-forward merge. Lokální změny, vlastní commity, jiná větev nebo rozcházející se historie update zastaví. Žádný reset, clean, stash ani automatické přepínání větve.
4. Pokud je daný commit už potvrzený jako nainstalovaný, otevře EXE bez opakování testů/buildu. První spuštění launcheru sestaví ověřenou verzi, protože původní instalace nemá potvrzení zdrojového commitu.
5. Nový commit projde lokálním verify, backend testy, standalone buildem a instalací. Launcher zůstává během práce viditelný a nabízí živý log; okno nelze zavřít uprostřed instalace. Po otevření aplikačního okna uloží potvrzený commit a zavře se.

Kontrola lokálního repozitáře a fetch mají společný limit 8 sekund. Při překročení se update přeskočí a otevře dostupná instalace; další start kontrolu zopakuje. Zjištění běžící aplikace používá Windows tasklist s limitem 3 sekund. Log uvádí dobu jednotlivých kontrol a okno rozlišuje lokální kontrolu, GitHub a stahování změn. Limit kontroly nepřerušuje následný fast-forward zápis do checkoutu, build ani instalaci; ty mohou trvat déle.

Při offline síti, chybě Gitu nebo selhání buildu launcher otevře předchozí dostupnou instalaci a zobrazí důvod. Při selhání samotné instalace je návrat možný jen pokud předchozí EXE zůstalo dostupné; nejde o transakční rollback Squirrel. Potvrzení commitu se neposune po chybě buildu, neplatném instalačním receipt nebo neúspěšném spuštění. Log posledního pokusu je `launcher.log`. Původní ikona **Ethical World** zůstává přímým spuštěním bez Git kontroly.

Pokud starší checkout zastaví `npm test` na `localStorage.clear()` s nedostupným úložištěm nebo hláškou o `--localstorage-file`, stáhni opravu větve a launcher spusť znovu po zavření aplikace otevřené fallbackem. DOM testy používají úložiště aktuální instance jsdom přes společný `tests/setup.ts`; nepřidávej diskový `--localstorage-file` a nepřeskakuj testy. Úspěšný pull sám nainstalované EXE neaktualizuje, nový pokus musí dokončit build a instalaci.

Současné předpoklady: Windows, Git s přístupem k repozitáři, Node/npm, Python a již použitý Windows packaging toolchain. První nový build může trvat několik minut. Launcher nepřidává CI/CD, publikaci Release ani placenou službu. WinForms/COM/Squirrel vyžadují ověření na skutečných Windows; lokální Git a helper testy toto ověření nenahrazují.

## Lokální model Máši na Windows

Nainstalovaný Ethical World spouští vlastní FastAPI backend. Po otevření Máši nově připraví i lokální Ollamu na `localhost:11434` nebo `127.0.0.1:11434`: využije běžící server, jinak najde nainstalované `ollama.exe` a spustí `serve` skrytě. Zvolený model předehřeje prázdným generate požadavkem. Okno aplikace na načítání modelu nečeká; stav je vidět v panelu Máši.

Výběr providera, modelu, Base URL a délky odpovědi se ukládá. API klíč ani AGENT oprávnění se tímto způsobem neukládají. Alias `masa-cyber` se může zpřesnit na `masa-cyber:latest`; stavová kontrola nepřepíná na jiný model. Chybějící instalace/model nebo timeout mají viditelnou hlášku. Automatický start nic nestahuje. Existující Ollama zůstává při zavření aplikace běžet; ukončuje se jen PID serveru spuštěného Ethical Worldem.

Vedle desktopu nespouštěj další uvicorn na portu 8787. Pro ruční diagnostiku Ollamy lze použít tento postup:

```powershell
$ErrorActionPreference = "Stop"
$ollamaPath = (Get-Command ollama -ErrorAction Stop).Source
$modelStatus = $null
try {
  $modelStatus = Invoke-RestMethod "http://127.0.0.1:11434/api/tags" -TimeoutSec 2
} catch {
  Start-Process -FilePath $ollamaPath -ArgumentList "serve" -WindowStyle Hidden
}

$modelDeadline = (Get-Date).AddSeconds(30)
while (-not $modelStatus -and (Get-Date) -lt $modelDeadline) {
  Start-Sleep -Milliseconds 500
  try {
    $modelStatus = Invoke-RestMethod "http://127.0.0.1:11434/api/tags" -TimeoutSec 2
  } catch {}
}
if (-not $modelStatus) { throw "Ollama na portu 11434 neodpovida." }
if (-not $modelStatus.models) { throw "Ollama nema zadny lokalni model." }
$modelStatus.models | Select-Object name, size
```

V nastavení Máši lze dát **Znovu najít lokální AI** pro opakování přípravy. Pro vlastní model nastav přesný název z výpisu (například `masa-cyber:latest`), provider Ollama a Base URL `http://127.0.0.1:11434`. Příprava je deduplikovaná a časově omezená; chat požadavky drží model v paměti pomocí `keep_alive: 15m`. Automatický start se týká desktopu a standardního Ollama portu; webový vývoj, vlastní port a llama-server používají samostatně spuštěný server.

Máša nabízí **Rychlá / Vyvážená / Podrobná**. Běžný chat posílá menší výběr kontextu a historie. Výslovný požadavek na podrobné vysvětlení zvýší rozpočet i v rychlé volbě; tvorba dokumentů má vlastní větší limit. Ollama odpovědi se zobrazují průběžně a tlačítko **Zastavit** přeruší stream a zachová rozepsané zadání. Návrhy poznámek se během streamu neprovádějí; obsah se objeví v náhledu po dokončení a validaci. Volný Markdown bez platného návrhu není uložená poznámka.

Pod odpovědí jsou skutečné tokeny vstup/výstup, součet, čas požadavku a tok/s. Rozbalení ukáže načtení modelu, zpracování promptu, generování, první token modelu a první viditelný text v chatu. Dále je počet znaků promptu, kontextových poznámek a zpráv historie. Znakový rozpočet není tokenizer ani tokenový odhad. Souhrn konverzace počítá jen odpovědi s dostupnými vstupními i výstupními počty; pomlčka znamená chybějící měření. OpenAI-compatible vrací dostupné usage počty a celkový čas, bez vymyšlené rychlosti generování.

Překročení kontextu, výstupní tokenový limit nebo přerušený akční blok blokují neúplné změny. Ollama požadavky posílají `truncate: false` a `shift: false`; jejich podporu je potřeba ověřit na instalované verzi Ollamy. Velké dokumenty může být nutné rozdělit. Skutečnou rychlost na konkrétním GPU/CPU ověří cold/warm odpovědi a stejné úlohy před/po; testovací HTTP odpovědi rychlost LLM nedokládají.

Pouze pro webový vývoj ve zdrojích lze místo desktopu ručně spustit gateway z kořene checkoutu: `.\.venv\Scripts\python.exe -m uvicorn server.main:app --host 127.0.0.1 --port 8787`. V dalším terminálu běží `npm run dev`; desktop při tomto postupu nech zavřený.

Reference: [Ollama Windows](https://docs.ollama.com/windows), [Ollama Chat API](https://docs.ollama.com/api/chat), [Ollama FAQ](https://docs.ollama.com/faq), [Ollama request types](https://github.com/ollama/ollama/blob/main/api/types.go).

## GitHub přihlášení v konektoru

GitHub pro zabudovaný Client ID aktuálně vrací `device_flow_disabled` (HTTP 400). Device OAuth musí být zapnutý v registraci dané GitHub aplikace; změna kódu toto nastavení na GitHubu nezapne. Konektor nyní ukazuje konkrétní důvod namísto obecné IPC výjimky.

Alternativa **Připojit tokenem** otevře samostatné izolované okno. Fine-grained PAT vytvoř v GitHub Settings → Developer settings → Personal access tokens, vyber potřebné repozitáře a oprávnění Contents: Read and write, Metadata: Read. Token se nejprve ověří přes `/user`, pak se uloží přes existující OS secure storage. Hlavní workspace dostane pouze stav a login, token se do něj nevrací. Zrušení nebo neplatný token existující připojení nepřepíše. OAuth varianta zůstává dostupná pro vlastní `ETHICAL_GITHUB_CLIENT_ID` s aktivním Device Flow.

Dokumentace GitHubu: [Device Flow](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps#device-flow) a [Personal access tokens](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens).
