# Ethical World

![Status](https://img.shields.io/badge/status-active--development-6f42c1)
![Desktop](https://img.shields.io/badge/desktop-Electron-47848F)
![React](https://img.shields.io/badge/React-19-61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6)
![AI](https://img.shields.io/badge/AI-local--first-111827)
![License](https://img.shields.io/badge/license-source--available-f59e0b)

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

The Ethical World name, visual identity and Rabbithollow Code Studio™ branding are not granted for rebranding or derivative distribution by publication of this repository.

## License

This repository is **source-available, not open source**.

Use of Ethical World is permitted only under the terms in the repository's `LICENSE`. Publication of the source code does not grant permission to rebrand, redistribute modified versions, create derivative products, or continue development under another identity without written permission from the copyright holder.

Copyright © 2026 Rabbithollow Code Studio™. All rights reserved.
