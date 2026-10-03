# Security

![Security](https://img.shields.io/badge/security-local--first-16a34a)
![Secrets](https://img.shields.io/badge/secrets-no_persistence-dc2626)
![Model](https://img.shields.io/badge/threat_model-active-f59e0b)

## Zásady

1. Poznámky zůstávají lokálně, dokud uživatel vědomě nezvolí vzdáleného AI providera.
2. API klíče se v MVP neukládají do localStorage ani IndexedDB.
3. Frontend komunikuje s lokálním FastAPI gateway.
4. AI kontext je omezený a transparentní.
5. Budoucí destruktivní tools budou používat approval flow.

## API keys

v0.1 přijímá API key pouze jako součást aktuálního requestu pro OpenAI-compatible provider. Produkční desktop varianta bude používat OS credential store.

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