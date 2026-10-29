# Connectors

![Local](https://img.shields.io/badge/local--markdown-ready-16a34a)
![GitHub](https://img.shields.io/badge/github-device--oauth-ready-6f42c1)
![Notion](https://img.shields.io/badge/notion-markdown--oauth-ready-16a34a)

## Princip

Ethical World synchronizuje znalostní obsah, ne celý zdrojový projekt. Connector adaptery pracují s Markdown dokumenty a zachovávají relativní cestu jako metadata původu poznámky.

## Local / VS Code workspace

- uživatel vybere lokální složku nebo VS Code workspace;
- importer čte pouze `.md` a `.mdx`;
- ignoruje `.git`, `node_modules`, `.venv`, `dist`, `out` a `build`;
- symbolic links se nepoužívají;
- maximálně 2000 souborů a 2 MiB na Markdown soubor;
- export chrání proti path traversal a zapisuje pouze do schváleného rootu.

## GitHub

Repozitář se neklonuje. Connector používá GitHub Device OAuth a Git/REST API pouze pro Markdown.

### Konfigurace

Ethical World má veřejný GitHub OAuth Client ID zabudovaný jako výchozí hodnotu. Client secret se do desktop aplikace nepoužívá. Volitelně lze Client ID přepsat přes `ETHICAL_GITHUB_CLIENT_ID`.

1. V Ethical World otevři **Connectors → GitHub → Připojit GitHub**.
2. Prohlížeč otevře device authorization a UI ukáže jednorázový kód.

Token se neukládá do IndexedDB ani localStorage. Electron ho ukládá pomocí OS `safeStorage`.

Import vyfiltruje pouze `.md/.mdx`. Export vytvoří Git blobs, nový tree a jeden commit, potom posune zvolenou branch bez force push.

Aktuální MVP používá OAuth scope `repo read:user`, aby uměl i private repozitáře. Produkční varianta má přejít na GitHub App s jemnějšími Contents permissions.

## Notion

Notion connection používá server-side OAuth code exchange. Client secret není součástí Electron balíčku.

Backend konfigurace:

```text
ETHICAL_NOTION_CLIENT_ID=...
ETHICAL_NOTION_CLIENT_SECRET=...
ETHICAL_NOTION_REDIRECT_URI=http://127.0.0.1:8787/api/connectors/notion/callback
```

Aktuální flow:

```text
Ethical World account
  ↓
server-side Notion OAuth start
  ↓
Notion authorization + page picker
  ↓
server callback + code exchange
  ↓
encrypted access/refresh token
  ↓
Notion enhanced Markdown API
  ↕
Ethical World notes
```

Connector umí vypsat přístupné stránky, importovat vybranou stránku jako Markdown note a zapsat obsah importované note zpět přes `replace_content`. Access token je v SQLite uložený pouze jako šifrovaný payload.
