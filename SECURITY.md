# Security

![Security](https://img.shields.io/badge/security-local--first-16a34a)
![Secrets](https://img.shields.io/badge/secrets-OS_encrypted-2563eb)
![Model](https://img.shields.io/badge/threat_model-active-f59e0b)

## Zásady

1. Poznámky zůstávají lokálně, dokud uživatel vědomě nezvolí vzdáleného AI providera.
2. API klíče se v MVP neukládají do localStorage ani IndexedDB.
3. Frontend komunikuje s lokálním FastAPI gateway.
4. AI kontext je omezený a transparentní.
5. Zapisovací AI tools používají READ / ASSIST permission gate a explicitní approval flow.

## API keys

OpenAI-compatible API key zůstává pouze v runtime paměti formuláře. GitHub OAuth token a Ethical World session token desktop ukládá přes Electron `safeStorage`; Notion access payload je šifrovaný v backend storage.

Nikdy necommituj `.env`, tokeny nebo API klíče.

## Prompt injection

Poznámky, importované názvy/IDs/složky a předchozí odpovědi modelu jsou nedůvěryhodný obsah. Pravidla jsou v systémové zprávě; vault data jsou JSON v oddělené user zprávě. JSON escapování a neutralizace známých ChatML/Llama/INST tokenů brání vložení surových hranic rolí do modelové šablony. Nezaručují, že model neposlechne podvržený přirozený text.

Oprávnění proto rozhoduje aplikace mimo model:

- READ nepřijímá žádné akce; ASSIST vyžaduje potvrzení konkrétního návrhu.
- AGENT smí automaticky pouze `create_note` v přesné složce z UI grantu při prvním zadání bez existujících poznámek, aktivní poznámky a konverzační historie. Takovému požadavku se nepřidávají nesouvisející složky. S vaultem či historií čekají všechny změny na potvrzení, i když model tvrdí, že souhlas už dostal.
- Režim, platnost grantu, přesná cílová složka a typ akce se znovu kontrolují bezprostředně před automatickým provedením. Modelové příznaky typu `user_confirmed` práva neudělují. Parser přijímá jen podporované akce a omezené argumenty; shell, mazání a konektorové/síťové operace nejsou LLM tools.
- Existující notes mají snapshot kontrolu; úplný přepis navíc vyžaduje celý vstupní obsah. Akce mají lokální audit.

Backend zastavuje doslovný opis alespoň 20 souvislých normalizovaných slov svého aktuálního pravidlového promptu; neporovnává obsah vaultu. Kontrola platí pro dokončené odpovědi i Ollama stream, který při chybě uzavře. Neprovádí další modelový request ani automatický retry. Úvod připomínající pravidla může být krátce zadržen; opis po jiném úvodu může být částečně vidět před chybou. Odmítnutá odpověď se neuloží do chatu a nepředá akce k provedení. Toto je omezená kontrola kvality/úniku instrukcí, nikoli bezpečnostní hranice oprávnění nebo obrana proti všem parafrázím, kódování či adaptivním útokům. Systémový prompt není úložiště secretů.

Markdown nemá vykonávat HTML nebo skripty. Vzdálené obrázky vyžadují kliknutí pro konkrétní HTTPS URL včetně query; změna URL vyžaduje nový souhlas. Kliknutí stále odešle URL vzdálenému serveru — před načtením zvaž její obsah. Lokální Ollama nezpřístupňuje modelu shell ani konektory aplikace. U zvoleného vzdáleného providera odchází vybraný kontext a historie na tento endpoint; citlivé údaje ve vlastních poznámkách se automaticky nezbavují citlivosti.

Regrese testují podvržení rolí v těle i metadatech, falešné souhlasy a scope, poisoned history, nepodporované tools, opis po malých stream chunkech, uzavření provideru a změnu URL obrázku. Jde o vybraný regresní soubor, ne o měření procentuální odolnosti LLM. Reálnou kvalitu a odolnost konkrétního `masa-cyber` je třeba ověřit na jeho nainstalované šabloně/modelu. Přístup OS uživatele nebo kompromitace rendereru je mimo tuto ochranu proti modelovým výstupům.

Návrh vychází z principů [OWASP Prompt Injection Prevention](https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html) a [OWASP AI Agent Security](https://cheatsheetseries.owasp.org/cheatsheets/AI_Agent_Security_Cheat_Sheet.html): oddělení dat a instrukcí, minimální oprávnění a autorizace v prováděcí vrstvě.

## CORS

Vývojový backend povoluje pouze lokální frontend originy. Při deploymentu je nutné seznam originů zúžit na skutečné domény.

## Hlášení problému

Citlivé bezpečnostní nálezy nepatří do veřejného issue včetně plných secretů. Ve veřejném reportu používej pouze redigované důkazy.

## Accounts a identity

Lokální backend používá SQLite databázi v uživatelském data adresáři (výchozí `~/.ethical-world/ethical-world.db`), nikoli v repozitáři.

- hesla se nešifrují reverzibilně; ukládají se jako `scrypt` hash s unikátním random saltem;
- session token je uživateli vydán pouze při loginu a v databázi se ukládá jen jeho SHA-256 hash;
- bootstrap admin účet se načítá pouze z `ETHICAL_WORLD_ADMIN_EMAIL`, `ETHICAL_WORLD_ADMIN_PASSWORD` a volitelného `ETHICAL_WORLD_ADMIN_NAME`;
- žádné bootstrap heslo ani session token nesmí být commitnuté.

## Budoucí E2E zprávy

Schema `message_envelopes` je záměrně ciphertext-only. Serverová databáze má v budoucnu ukládat šifrovanou zprávu, nonce a metadata nutná k doručení, nikoli plaintext.

Kryptografický protokol pro týmový chat nebude vlastní návrh. Produkční verze má použít auditovanou implementaci typu Signal protocol / Double Ratchet s per-device identity keys a prekeys. Dokud tato vrstva není implementovaná a auditovaná, dokumentace nesmí tvrdit, že chat má Signal/Telegram-equivalentní E2E bezpečnost.


## Connector a session secrets

GitHub OAuth token ani Ethical World session token nejsou ukládané v renderer storage. Desktop používá Electron `safeStorage`, takže na disk jde pouze OS-encrypted blob.

GitHub Device OAuth je dostupný pouze s vlastním `ETHICAL_GITHUB_CLIENT_ID`; sdílený zabudovaný Client ID byl odstraněný. Main proces vyžaduje nativní souhlas před zahájením, přijímá pouze pevné HTTPS endpointy GitHubu bez redirectů a kód vrácený GitHubem, který zobrazí také nativní dialog před otevřením prohlížeče. Výchozí `public_repo` dává čtení/zápis veřejných repozitářů; širší `repo` pro private repositories vyžaduje explicitní výběr a nativní potvrzení. Obě OAuth oprávnění zahrnují více než samotné Markdown soubory. Pro omezení na vybraná repa používej fine-grained PAT s Contents permissions; další krok je GitHub App.

Device grant se kontroluje podle schváleného scope i skutečné hlavičky `X-OAuth-Scopes` z ověřeného `/user`. Neočekávaná širší oprávnění se odmítnou. Login se před uložením potvrzuje v nativním dialogu; workspace nikdy nedostane token ani `device_code`. Main vynucuje jeden flow/poll, TTL a `slow_down`; cancel, disconnect, reload a zavření okna zneplatní opožděné odpovědi. Zápis a odpojení používají jednu frontu; při zrušení během zápisu se obnoví předchozí credential. Privilegované IPC přijímá pouze vlastní main frame.

Tato ochrana nezabrání schválení útočníkova Device OAuth kódu mimo aplikaci na skutečném webu GitHubu. Používej pouze kód právě zahájeného přihlášení, ověř doménu i název své OAuth aplikace. Client ID je veřejný identifikátor, nikoli secret nebo důkaz identity vlastníka. Dříve uložené tokeny automaticky neztrácejí svá oprávnění; jejich grant můžeš odebrat v GitHub Settings → Applications. Lokální odpojení odstraní uložený token, nerevokuje grant na GitHubu.

Notion public OAuth client secret nesmí být součástí desktop aplikace. Code exchange a refresh tokeny musí obsluhovat serverová vrstva.

Browser fallback ukládá app session pouze do `sessionStorage`, nikoli persistentního localStorage.

## Owner bootstrap

Při první databázi backend vytvoří lokální owner identitu `owner@ethical.world.local` s náhodným interním verifierem. Neexistuje sdílené default heslo. Dokud owner nenastaví vlastní heslo, je dostupná pouze bootstrap session a UI zůstává zamčené na Identity view. Změna hesla používá nový scrypt salt a zruší `must_change_password`.

## Notion secrets

Notion OAuth code exchange probíhá výhradně v backendu. Access payload je před uložením do `connector_secrets` šifrovaný Fernetem. Klíč lze dodat přes `ETHICAL_WORLD_CONNECTOR_KEY`; lokální fallback generuje klíč mimo Git repozitář. Renderer Notion token nikdy nedostává.


## Mermaid preview

Mermaid source z poznámek je nedůvěryhodný obsah stejně jako ostatní Markdown.

Renderer proto:

- načítá Mermaid až při skutečném `mermaid` fenced blocku;
- používá `securityLevel: "strict"`;
- vypíná start-on-load;
- omezuje maximální délku vstupu a počet hran;
- při parse chybě nevykonává fallback HTML, ale zobrazí původní Mermaid source jako kód.

Máša je navíc instruovaná nepoužívat click callbacky, HTML labely ani init direktivy.

## Carrot integrity

Před zobrazením `podpis ověřen` se znovu počítá:

1. SHA-256 snapshot hash z aktuálně uloženého `title + folder + content`;
2. commit hash z kanonického Carrot payloadu;
3. vazba `parentId + parentCommitHash` proti skutečnému parent commitu v lokální historii;
4. teprve potom Ed25519 podpis přes Electron bridge.

Samotné zachování starého `snapshotHash` a podpisu tedy nestačí, pokud někdo ručně změní uložený Markdown snapshot.


## Hardening 2026-10-06

API vyžaduje neveřejnou runtime capability; výjimkou jsou health challenge a Notion OAuth callback. Owner bootstrap lze použít jednou za běh backendu. Desktop důvěřuje pouze vlastnímu procesu s ověřeným HMAC proof a předává požadavky přes omezené IPC. Web dev/preview používá same-origin proxy s kontrolou Host/Origin. Runtime descriptor patří do uživatelského datového adresáře, nikoli do repozitáře.

Provider proxy ověřuje URL i DNS a připojuje se na ověřenou IP; vzdálené providery musí být HTTPS a v `ETHICAL_WORLD_PROVIDER_HOSTS` (výchozí api.openai.com, api.groq.com, openrouter.ai). Lokální modely musí být na loopbacku. Auth má rate limit, scrypt běží mimo event loop; chat má limit souběhu a požadavky/odpovědi mají velikostní limity.

Carrot ověřuje signer proti identitě uložené pomocí OS safeStorage a potvrzenému checkpointu. Neznámý klíč nebo rollback podepsané historie je chyba. Lokální export odmítá symlinky/junctions a neznámé změny souborů; GitHub export kontroluje importované blob SHA a aktualizuje branch bez force. Notion kontroluje importovaný obsah před zápisem, ale API neposkytuje atomický compare-and-swap.

Účty nejsou oddělené šifrované vaulty. Poznámky sdílí lokální profil zařízení; logout není uzamčení IndexedDB. Kompromitace OS uživatele je mimo tuto hranici důvěry. Notion šifrovací klíč je nadále v datovém adresáři; migrace do OS key store zůstává otevřená. Vzdálené obrázky se načítají až po explicitním kliknutí.
