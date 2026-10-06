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

Poznámky jsou nedůvěryhodný obsah. AI nesmí interpretovat text uvnitř poznámky jako systémové oprávnění k mazání nebo změně dat. Tool permissions musí být kontrolované aplikací.

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

GitHub Device OAuth MVP používá širší `repo` scope kvůli private repositories. Produkční distribuce má přejít na GitHub App s minimálními Contents permissions.

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
