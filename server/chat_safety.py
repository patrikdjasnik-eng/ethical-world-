"""Prompt/data separation and a bounded guard against verbatim policy echo.

These are quality/defence-in-depth controls, not tool authorization or a claim
that a model can reliably distinguish every prompt injection.
"""
from __future__ import annotations

import json
import re

from .providers import ProviderError


_CHAT_TOKENS = re.compile(r"<\|[^\s<>]{1,80}\|>|\[/?INST\]|<</?SYS>>")


def neutralize_chat_tokens(content: str) -> str:
    # Common model templates use these as role boundaries. Keep them readable
    # as literal text, never as raw special-token strings in untrusted input.
    return _CHAT_TOKENS.sub(
        lambda match: match.group().replace("<", r"\u003c").replace(">", r"\u003e").replace("[", r"\u005b").replace("]", r"\u005d"),
        content,
    )


def untrusted_json(value: object) -> str:
    return neutralize_chat_tokens(json.dumps(value, ensure_ascii=False, separators=(",", ":"))).replace("<", r"\u003c").replace(">", r"\u003e")


def _words(text: str) -> list[str]:
    return re.findall(r"\w+", text.casefold())


class PolicyEchoGuard:
    """Reject 20 copied instruction words; do not match retrieved note data.

    Only a possible copied opening is buffered. Ordinary replies diverge after
    a few characters and continue streaming without waiting for completion.
    Later copies are rejected before a final response/action can be returned.
    This intentionally does not attempt to detect paraphrases/encoded leaks.
    """

    error = "Model začal opisovat interní instrukce. Odpověď byla zastavena; nic se neprovedlo. Zkus zadání znovu, při opakování zkontroluj šablonu modelu."
    span = 20

    def __init__(self, policy: str):
        words = _words(policy)
        self.windows = {tuple(words[i:i + self.span]) for i in range(len(words) - self.span + 1)}
        for window in tuple(self.windows):
            if window[0] == "jsi":
                self.windows.add(("jsem", *window[1:]))
        self.openings = [" ".join(window) for window in self.windows]
        self.pending = ""
        self.tail = ""
        self.opening = True

    def check(self, content: str) -> None:
        words = _words(content)
        if any(tuple(words[i:i + self.span]) in self.windows for i in range(len(words) - self.span + 1)):
            raise ProviderError(self.error)

    def feed(self, delta: str) -> str:
        self.tail = self.tail[-65536:] + delta
        self.check(self.tail)
        # Keep complete words plus the unfinished last word, including whitespace.
        matches = list(re.finditer(r"\w+", self.tail))
        if len(matches) > self.span + 1:
            self.tail = self.tail[matches[-self.span - 1].start():]
        if not self.opening:
            return delta
        self.pending += delta
        normalized = " ".join(_words(self.pending))
        if len(self.pending) < 65536 and normalized and any(candidate.startswith(normalized) for candidate in self.openings):
            return ""
        self.opening = False
        result, self.pending = self.pending, ""
        return result

    def finish(self) -> str:
        self.check(self.pending)
        result, self.pending = self.pending, ""
        return result
