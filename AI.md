# AI Layer

![AI](https://img.shields.io/badge/AI-agent_layer-7c3aed)
![Local](https://img.shields.io/badge/local--first-enabled-16a34a)
![Providers](https://img.shields.io/badge/providers-router-334155)
![Mode](https://img.shields.io/badge/agent-permissioned-111827)

## Role agentky

Máša není jen chat panel. Cílem je, aby fungovala jako permissioned agent nad Ethical World vaultem: rozuměla aktuální poznámce, relevantnímu knowledge graphu, uměla navrhovat změny a v agent režimu používat nástroje aplikace.

Aktuální v0.1 podporuje:

- kontext otevřené poznámky;
- omezený kontext vaultu;
- Ollama;
- OpenAI-compatible endpoint;
- automatické hledání lokálního modelu;
- model a endpoint nastavitelné v UI;
- API key pouze v runtime paměti formuláře.

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

Backend provider router request převede na konkrétní modelové API.

OpenAI-compatible režim umožňuje lokální `llama-server`, self-hosted inference i kompatibilní cloud provider.

## RAG

Další vrstva přidá embeddings, chunking, hybridní retrieval a citace zdrojových poznámek.

Cílový flow:

```text
dotaz
→ hybrid search
→ relevantní chunks
→ note ids + paths
→ Máša
→ odpověď s odkazy na zdroje
```

## Vault tools

Máša má používat stejné doménové operace jako UI, ne obcházet data vrstvu.

Plánované tools:

```text
searchNotes()
readNote()
createNote()
updateNote()
linkNotes()
moveNote()
createFolder()
renameNote()
findRelatedNotes()
createTask()
summarizeVault()
createCyberReport()
```

One-click Markdown insert vrstva je první společný základ: UI i agent budou vytvářet wiki links, code blocks, tasky a další Markdown přes stejné deterministické operace.

## Agent permissions

Režimy:

- `READ` – pouze čtení vaultu a odpovědi.
- `ASSIST` – Máša připraví návrh změny a diff.
- `AGENT` – povolené zapisovací tools v definovaném scope.

Mazání, hromadné přesuny a větší přepisy musí mít preview nebo explicitní potvrzení.

## Coding assistant

Máša má být použitelná jako technická kopilotka pro:

- TypeScript, JavaScript, Python, PowerShell, Bash, C/C++, SQL, YAML a další jazyky;
- debugging;
- code review;
- návrh architektury;
- testy;
- automatizace;
- dokumentaci;
- převod terminálových výstupů do strukturovaných poznámek.

Výsledek může Máša rovnou navrhnout jako nový Markdown dokument, code block nebo propojenou sadu poznámek.

## Cybersecurity workspace

Ethical World má podporovat obrannou a autorizovanou cybersecurity práci napříč oblastmi, kde dává knowledge vault smysl:

- networking a protokoly;
- Windows/Linux administrace a hardening;
- web a application security;
- secure coding a code review;
- vulnerability research nad vlastním nebo povoleným prostředím;
- log analysis;
- SIEM/detection engineering;
- incident response;
- threat hunting;
- malware/reverse-engineering poznámky a analýzu dodaných artefaktů;
- cloud, kontejnery a identity;
- pentest notes pro systémy, ke kterým má uživatel oprávnění;
- reporty, findings, evidence, remediation a retest.

Agentní akce musí respektovat scope konkrétního projektu a oddělovat návrh, provedení a auditní záznam.

## Cílový agent loop

```text
Uživatel
  ↓
Máša
  ↓
RAG / aktuální note / graph
  ↓
Planner
  ↓
Tool request
  ↓
Permission gate
  ↓
Preview / diff
  ↓
Apply
  ↓
Audit log
```

Cílem není automatizovat vše bez kontroly. Cílem je, aby běžná práce vyžadovala méně klikání a syntaktických znalostí, zatímco rizikové změny zůstaly explicitní a dohledatelné.


## Agent tools v0.1

Máša má první skutečné schopnosti nad UI a vaultem přes potvrzovaný ASSIST režim.

Aktuálně dostupné akce:

- vytvořit poznámku;
- upravit existující poznámku podle přesného note ID;
- vytvořit složku;
- otevřít existující poznámku.

Model nikdy nezapisuje přímo do IndexedDB. Vrací omezený `ethical-actions` JSON blok, renderer ho validuje a uživatel musí každou zapisovací akci potvrdit tlačítkem `Použít`. READ režim žádné tool akce nepřijímá.

Mazání, přejmenování, hromadné přesuny a jiné destruktivní operace v této verzi nejsou dostupné.
