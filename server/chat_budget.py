from __future__ import annotations

from dataclasses import dataclass
import re


@dataclass(frozen=True)
class ChatBudget:
  context_chars: int
  index_chars: int
  history_chars: int
  history_messages: int
  output_tokens: int


def chat_workload(text: str, permission: str, history: list[str] | None = None) -> str:
  value = text.casefold()
  note_words = ("poznám", "poznam", "markdown", " md", " note", "dokument")
  actions = ("vytvoř", "vytvor", "udělej", "udelej", "napiš", "napis", "zapiš", "zapis", "ulož", "uloz", "zpracuj", "připrav", "priprav", "přepracuj", "prepracuj", "uprav", "přidej", "pridej", "doplň", "dopln", "vlož", "vloz", "zapracuj", "zakresli", "rozšiř", "rozsir", "aktualizuj", "update", "create", "write", "edit", "append", "save")
  has_note = any(word in value for word in note_words) or bool(re.search(r"(?:^|\s)(?:md|note)(?:\s|$)", value))
  followup = any(word in value for word in ("do nich", "všech", "vsech", "těch", "tech", "tří", "tri", "them", "those")) and any(any(word in older.casefold() for word in note_words) for older in (history or [])[-6:])
  if permission != "read" and (has_note or followup) and any(word in value for word in actions):
    return "document"
  vault_words = (*note_words, "vault", "složk", "slozk", "folder", "úkol", "ukol", "task", "přesuň", "presun", "přejmen", "prejmen", "otevři", "otevri", "wiki", "navaz", "návaz", "těch", "tech tri", "those", "move", "rename", "open")
  return "vault" if any(word in value for word in vault_words) else "chat"


def requested_style(text: str, style: str) -> str:
  if style == "fast" and any(word in text.casefold() for word in ("podrob", "detail", "hloub", "důklad", "duklad", "thorough", "in depth")):
    return "detailed"
  return style


def chat_budget(workload: str, style: str) -> ChatBudget:
  if workload == "document":
    return ChatBudget(30000, 14000, 12000, 16, 6144)
  if workload == "vault":
    return {
      "fast": ChatBudget(12000, 4000, 6000, 12, 1536),
      "balanced": ChatBudget(18000, 6000, 10000, 16, 2048),
      "detailed": ChatBudget(30000, 14000, 20000, 20, 3072),
    }[style]
  return {
    "fast": ChatBudget(2000, 1000, 3000, 8, 768),
    "balanced": ChatBudget(6000, 2000, 6000, 12, 1536),
    "detailed": ChatBudget(16000, 4000, 14000, 20, 3072),
  }[style]


def compact_history(messages: list[dict[str, str]], budget: ChatBudget) -> list[dict[str, str]]:
  # Keep the latest request intact; older excerpts are explicitly marked as partial.
  latest = messages[-1]
  remaining = max(0, budget.history_chars - len(latest["content"]))
  selected = [latest]
  marker = "\n[ZKRÁCENÁ HISTORIE: nejde o úplný dokument.]"
  for message in reversed(messages[:-1][-budget.history_messages + 1:]):
    content = message["content"]
    if len(content) <= remaining:
      selected.append(message)
      remaining -= len(content)
    else:
      if remaining > len(marker):
        selected.append({"role": message["role"], "content": content[:remaining - len(marker)] + marker})
      break
  return list(reversed(selected))
