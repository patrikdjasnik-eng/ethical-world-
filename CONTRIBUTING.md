# Contributing

![Contributing](https://img.shields.io/badge/contributing-guidelines-2563eb)
![Code Style](https://img.shields.io/badge/code_style-TypeScript_strict-3178c6)
![Tests](https://img.shields.io/badge/tests-required-16a34a)

## Branching

`main` je stabilní větev. Aktivní MVP vývoj probíhá na `dev/first-runnable`.

## Commit messages

Používej stručné dvojjazyčné commit zprávy s emoji, například:

```text
🧠 feat: přidal jsem AI router / add AI router
🐛 fix: opravil jsem autosave / fix autosave
📝 docs: doplnil jsem architekturu / document architecture
```

## TypeScript

- strict typing;
- camelCase;
- 2 mezery;
- smysluplné komentáře pouze tam, kde vysvětlují důvod;
- žádné dekorativní ASCII oddělovače;
- chyby řešit explicitně.

## Testy

Každá změna v parsování poznámek, search logice nebo AI routing vrstvě má mít test nebo jasný důvod, proč test není praktický.

Před merge spusť:

```powershell
npm test
npm run build
```