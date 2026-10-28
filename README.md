# Ethical World

![Status](https://img.shields.io/badge/status-active--development-6f42c1)
![Desktop](https://img.shields.io/badge/desktop-Electron-47848F)
![React](https://img.shields.io/badge/React-19-61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6)
![AI](https://img.shields.io/badge/AI-local--first-111827)
![License](https://img.shields.io/badge/license-AGPL--3.0--only-blue)

**Ethical World** is a local-first knowledge workspace built around Markdown, connected notes, a visual knowledge graph and an integrated AI copilot called **Máša**.

> Active development happens on the `dev/first-runnable` branch. The `main` branch intentionally stays as the stable public project entry point.

## What Ethical World is becoming

Ethical World combines an Obsidian-style knowledge vault with an AI-assisted workspace focused on technical learning, software development and cybersecurity education.

Current development includes:

- Markdown notes, folders, wiki links and backlinks;
- interactive knowledge graph;
- local-first AI through Ollama and OpenAI-compatible runtimes;
- Máša READ / ASSIST permission modes;
- full Markdown Knowledge Notes with diagrams, code blocks and contextual links;
- Local / VS Code Markdown connector;
- GitHub Device OAuth Markdown sync;
- Notion Markdown import and write-back;
- local SQLite identity layer;
- **Carrot** signed Markdown history with hash chaining and per-device Ed25519 signatures;
- Windows Electron desktop shell and standalone backend packaging;
- bilingual in-app Guide and Updates.

## Máša

Máša is the built-in local AI copilot.

She can answer general technical questions, work with the current vault context and, in ASSIST mode, prepare approved changes such as creating or updating notes and folders.

Knowledge Note mode can produce complete Markdown documents and decide when Mermaid diagrams, Prisma schemas, code blocks, tables, checklists or existing `[[wiki links]]` improve the note.

Write actions remain approval-gated.

## Local-first by design

The project is designed so local notes and local AI can stay on the user's machine. Remote connectors are explicit and scoped.

Desktop secrets are kept out of renderer storage. GitHub tokens use Electron OS secure storage, while Notion OAuth tokens are handled by the backend and stored encrypted.

## Development branch







<img width="1919" height="1079" alt="Bez názvu" src="https://github.com/user-attachments/assets/9c49af1b-06f3-475b-8e98-4d0ace41920c" />


The runnable development branch is:

```text
dev/first-runnable
```

Developer documentation currently lives there:

- `DEV-NOTES.md`
- `ARCHITECTURE.md`
- `SECURITY.md`
- `AI.md`
- `CONNECTORS.md`
- `CARROT.md`

## Brand

Ethical World is created by **Rabbithollow Code Studio™**.

The **Ethical World** name, logos and visual identity, as well as the **Rabbithollow Code Studio** name and logos, are project trademarks/branding and are not licensed by the software license. You may truthfully refer to the project and identify your fork, but do not imply that an independent fork is the official project or use our branding in a way that suggests endorsement. See [TRADEMARKS.md](TRADEMARKS.md).

## License

Ethical World is licensed under the **GNU Affero General Public License v3.0 only (AGPL-3.0-only)**. You can use, study, modify, and redistribute the software, including commercially, provided you comply with the license. If you distribute a modified version or make it available for users to interact with over a network, the AGPL's corresponding-source requirements may apply.

The license keeps covered derivative versions under the same copyleft terms; it does **not** prohibit commercial use, forks, or rebranding by itself. Project names, logos and branding are separate from the software license; see [TRADEMARKS.md](TRADEMARKS.md).

- Full license text: [LICENSE](LICENSE)
- SPDX identifier: `AGPL-3.0-only`

Copyright © 2026 Patrik Djasník / Rabbithollow Code Studio.
