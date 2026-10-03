# Connectors

![Local](https://img.shields.io/badge/local--markdown-ready-16a34a)
![GitHub](https://img.shields.io/badge/github-device--oauth-ready-6f42c1)
![Notion](https://img.shields.io/badge/notion-server--oauth-next-f59e0b)

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

### Testovací konfigurace

1. V GitHub Developer Settings vytvoř OAuth App.
2. Zapni **Enable Device Flow**.
3. Pro desktop test potřebuješ pouze Client ID.
4. Před spuštěním desktop dev nastav:

```powershell
$env:ETHICAL_GITHUB_CLIENT_ID="TVUJ_CLIENT_ID"
npm run desktop:dev
```

5. V Ethical World otevři **Connectors → GitHub → Připojit GitHub**.
6. Prohlížeč otevře device authorization a UI ukáže jednorázový kód.

Token se neukládá do IndexedDB ani localStorage. Electron ho ukládá pomocí OS `safeStorage`.

Import vyfiltruje pouze `.md/.mdx`. Export vytvoří Git blobs, nový tree a jeden commit, potom posune zvolenou branch bez force push.

Aktuální MVP používá OAuth scope `repo read:user`, aby uměl i private repozitáře. Produkční varianta má přejít na GitHub App s jemnějšími Contents permissions.

## Notion

Notion public connection vyžaduje server-side OAuth code exchange. Client secret proto nesmí být součástí Electron balíčku.

Plánovaný flow:

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

Notion 2026 API podporuje přímé čtení stránky jako Markdown a update page content jako Markdown, takže connector nemusí ručně převádět celý block tree.
