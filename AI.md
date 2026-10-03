# AI Layer

![AI](https://img.shields.io/badge/AI-agent_layer-7c3aed)
![Local](https://img.shields.io/badge/local--first-enabled-16a34a)
![Providers](https://img.shields.io/badge/providers-router-334155)

## Role agentky

AI v Ethical World není jen samostatný chat. Je to vrstva nad vaultem, která dostává kontext otevřené poznámky a relevantních poznámek.

v0.1 podporuje:

- kontext aktuální poznámky;
- kontext omezené části vaultu;
- Ollama;
- OpenAI-compatible endpoint;
- model a endpoint nastavitelné v UI;
- API key pouze v runtime paměti formuláře, ne v IndexedDB ani localStorage.

## Provider routing

Frontend posílá jednotný payload:

```json
{
  "provider": "ollama",
  "model": "qwen2.5:7b",
  "baseUrl": "http://localhost:11434",
  "messages": [],
  "vaultContext": []
}
```

Backend provider router tento request převede na konkrétní API.

OpenAI-compatible režim umožní použít například lokální `llama-server`, self-hosted inference nebo cloud službu se stejným API formátem.

## API key detection

Budoucí provider wizard bude používat pouze bezpečné prefix hints a explicitní verify krok. Klíč nebude zkoušen proti náhodným providerům, protože by tím mohl uniknout třetí straně.

## RAG

v0.2 přidá embeddings, chunking a semantic retrieval. Model pak nebude dostávat celý vault, ale jen relevantní úseky s odkazy na zdrojovou poznámku.

## Agent permissions

Plánované režimy:

- `READ` – pouze čtení vaultu.
- `ASSIST` – návrhy změn.
- `AGENT` – povolené zápisové tools.

Mazání, hromadné přesuny a přepis většího množství poznámek musí mít potvrzení nebo diff.