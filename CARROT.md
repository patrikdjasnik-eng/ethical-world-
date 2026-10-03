# Carrot

![Carrot](https://img.shields.io/badge/Carrot-signed_history-f97316)
![Hash](https://img.shields.io/badge/hash-SHA--256-334155)
![Signature](https://img.shields.io/badge/signature-Ed25519-6f42c1)
![Storage](https://img.shields.io/badge/storage-IndexedDB-0ea5e9)

**Carrot** je interní verzovací a auditní vrstva Ethical World pro Markdown poznámky.

Není to náhrada Gitu. Git verzionuje projektový repozitář; Carrot verzionuje obsah knowledge vaultu přímo v aplikaci.

## Commit model

Každý Carrot commit obsahuje:

```text
id
noteId
parentId
title
folder
content
snapshotHash
commitHash
parentCommitHash
message
authorUserId
authorDisplayName
createdAt
signatureAlgorithm
signature
publicKey
keyId
```

`snapshotHash` je SHA-256 aktuálního názvu, folderu a kompletního Markdown obsahu.

`commitHash` je SHA-256 kanonického commit payloadu. `parentCommitHash` kryptograficky navazuje commit na předchozí verzi.

## Podpis

Desktop používá Ed25519.

```text
first Carrot commit
  ↓
Electron main
  ↓
generate Ed25519 device keypair
  ↓
private key → OS safeStorage
public key  → commit metadata
  ↓
sign canonical Carrot payload
```

Private key renderer nikdy nedostává.

UI může podpis zpětně ověřit přes úzký Electron IPC bridge.

## Author identity

Pokud je uživatel přihlášený, commit ukládá jeho Ethical World user ID a display name.

Pokud účet není dostupný, lze vytvořit lokální anonymous snapshot. Desktop podpis zařízení může být stále přítomný, ale není totéž jako ověřená lidská identita.

## Kdy vzniká commit

Carrot aktuálně zaznamenává:

- změny aktivní poznámky po krátkém idle autosavu;
- vytvoření nové poznámky;
- přesun poznámky;
- folder path změny;
- Markdown import z konektorů;
- create/update akce provedené Mášou.

Identický stav se podruhé neukládá.

## Threat model

Carrot pomáhá zjistit změnu lokální historie, ale není vzdálený transparency log.

Útočník s plnou kontrolou nad uživatelským OS může teoreticky napadnout aplikaci, secure storage i lokální databázi. Pro budoucí team režim bude vhodné podepsané commit hashe navíc replikovat na server nebo append-only audit log.

## Privacy

Carrot ukládá kompletní starší Markdown snapshoty. To je záměr kvůli plné historii, ale znamená to, že text odstraněný z aktuální poznámky může stále existovat v Carrot historii.

Budoucí UI musí mít explicitní retention/export/delete pravidla, zejména pro citlivé vaulty.
