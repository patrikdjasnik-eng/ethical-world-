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
- API key pouze v runtime paměti formuláře;
- Knowledge Note mode s raw Markdown envelope;
- skutečný lokální Mermaid renderer v Markdown preview;
- zachování chat session při schování Máša panelu.

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

Doménové nástroje a generované výstupy (implementační stav viz tabulka níže):

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
- `AGENT` – nové poznámky ve složce explicitně povolené pro session; ostatní akce se potvrzují.

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
- otevřít existující poznámku;
- přejmenovat nebo přesunout poznámku;
- propojit existující poznámky wiki odkazem;
- přidat Markdown úkol.

Model nikdy nezapisuje přímo do IndexedDB. Vrací omezený `ethical-actions` JSON blok, renderer ho validuje a ASSIST vyžaduje potvrzení tlačítkem `Použít`. V AGENT režimu se create_note ve schválené složce provede automaticky; jiné operace čekají na potvrzení. READ režim žádné tool akce nepřijímá.

Mazání není dostupné. Přejmenování a přesuny jednotlivých poznámek mají náhled a potvrzení; hromadný návrh je omezený na 8 akcí.


## Knowledge Note mode

Máša má specializovaný režim pro tvorbu celých Markdown dokumentů přímo z LLM chatu.

Detekovaný požadavek typu „vytvoř / napiš / zpracuj kompletní MD poznámku…“ přepne backend na delší generation budget a model vrací raw Markdown přes `<ethical-note>` envelope. Díky tomu může dokument bezpečně obsahovat běžné trojité code fences bez JSON escapování.

Knowledge note pipeline:

```text
LLM chat input
  ↓
Knowledge Note mode
  ↓
raw Markdown envelope
  ↓
parser + schema validation
  ↓
Ethical World badge header
  ↓
wiki-link validation against vault index
  ↓
ASSIST approval
  ↓
vault note
```

Máša má při authoringu rozhodovat podle významu, nikoli mechanicky:

- Mermaid pro architekturu, flow, síťové vztahy, lifecycle a procesy; fenced `mermaid` blok se po uložení skutečně vykreslí v Preview přes lazy-loaded Mermaid runtime v strict režimu;
- Prisma schema pro databázové entity, identity, messaging, backendové vztahy a ORM návrhy;
- správně označené code blocks pro relevantní programovací/shell/config příklady;
- tabulky a checklisty tam, kde zvyšují čitelnost;
- `[[wiki links]]` pouze na přesně existující názvy poznámek z vault indexu;
- krátkou sekci souvisejících poznámek pouze pokud existují skutečné návaznosti.

Každá AI-authored knowledge note dostává programově badge hlavičku, takže ji model nemůže omylem vynechat.

Cybersecurity persona je edukativně široká: Máša může vysvětlovat malware, útočné techniky, exploit concepts, reverse engineering i obranu. Samotná registrace účtu není bezpečnostní bypass; rizikové praktické kroky se mají držet v autorizovaném lab/defenzivním scope.

## Implementační stav 2026-10-06

Konkrétní hranice implementace a způsob provedení:

| Schopnost | Skutečné provedení |
| --- | --- |
| searchNotes / readNote / findRelatedNotes | Lokální lexikální retrieval, přímý lookup ID a wiki návaznosti; relevantní obsah se přidává před posledními poznámkami. Nejde o embeddings ani hybrid RAG. |
| createNote / updateNote / createFolder / openNote | Validovaný action/envelope protokol a zápis přes stejnou datovou vrstvu jako UI. |
| renameNote / moveNote / linkNotes / createTask | Akce rename_note, move_note, link_notes a create_task. Přesun jen do existující složky; task je Markdown checkbox; link má jednoznačný existující cíl. |
| summarizeVault / createCyberReport / coding assistant | Generování textu nebo Markdown poznámky připojeným modelem. Shrnutí pokrývá omezený vyhledaný kontext; report neznamená provedení síťového skenu nebo spuštění kódu. |
| READ | Žádné návrhy se nezařazují k provedení. |
| ASSIST | Každá akce čeká na potvrzení, obsah a změna cesty mají rozbalitelný náhled. |
| AGENT | Uživatel musí pro tuto session zvolit konkrétní složku. Automaticky lze pouze vytvořit nové poznámky v ní, maximálně 8 akcí v jedné odpovědi. Ostatní operace čekají na potvrzení. Změna režimu zruší čekající návrhy i grant. |
| Audit log | IndexedDB agentAudit: zahájení, výsledek nebo chyba; export JSON v AI nastavení. Neobsahuje API klíče ani celé poznámky. |

Přepisy existující poznámky jsou chráněné snapshot baseline z okamžiku návrhu. Změněná poznámka vyžaduje nový návrh. Backend vrací completeNoteIds: celkový kontext má budget 30 000 znaků, každý vstup maximálně 10 000. Návrh nahrazení obsahu je odmítnut, pokud model neměl celý cílový dokument. Přidání tasku nebo odkazu zachovává původní obsah deterministicky. Pro velké dokumenty pracuj po menších poznámkách.

AGENT grant se neukládá mezi sessions; shell, mazání, externí zápisy a neomezená autonomie nejsou dostupné. Modelové výstupy mají stále závislost na schopnostech zvoleného LLM. Aplikace zaručuje validaci a permission gate, nikoli faktickou správnost libovolného generovaného textu. Starší chat paměť je posuvné okno posledních 40 zpráv, nikoli trvalá dlouhodobá modelová paměť.
