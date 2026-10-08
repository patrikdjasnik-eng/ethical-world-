"""Validated document proposals; model output never grants write permission."""
from __future__ import annotations

import re
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationError

from .providers import ProviderError


class NoteProposal(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    operation: Literal["create", "update"]
    noteId: str = Field(max_length=200)
    title: str = Field(min_length=1, max_length=300)
    folder: str = Field(max_length=500)
    content: str = Field(min_length=1, max_length=60000)


class FolderProposal(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    name: str = Field(min_length=1, max_length=160)
    parentPath: str = Field(max_length=500)



class NoteOutput(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    folders: list[FolderProposal] = Field(default_factory=list, max_length=7)
    notes: list[NoteProposal] = Field(min_length=1, max_length=8)


def note_actions(raw: str, complete_ids: list[str], folders: list[str], scope: str | None) -> list[dict]:
    try:
        output = NoteOutput.model_validate_json(raw)
    except ValidationError as error:
        raise ProviderError("Model nedokončil platný návrh poznámek. Nic se neuložilo; zadání zůstává rozepsané.") from error
    allowed_folders = {"", *folders}
    if scope is not None:
        allowed_folders.add(scope)
    actions = []
    if len(output.folders) + len(output.notes) > 8:
        raise ProviderError("Návrh přesáhl limit 8 akcí. Nic se neuložilo.")
    for folder in output.folders:
        name = folder.name
        path = f"{folder.parentPath}/{name}" if folder.parentPath else name
        if name != re.sub(r"\s+", " ", name).strip() or re.search(r'[\\/:*?"<>|]', name) or re.search(r"\s{2,}", name) or name in (".", "..") or folder.parentPath not in allowed_folders or path in allowed_folders or len(path) > 500:
            raise ProviderError("Návrh obsahuje neplatnou nebo duplicitní složku. Nic se neuložilo.")
        allowed_folders.add(path)
        actions.append({"type": "create_folder", "name": name, "parentPath": folder.parentPath or None})
    targets = set()
    for note in output.notes:
        if not note.title.strip() or not note.content.strip() or note.folder not in allowed_folders:
            raise ProviderError("Návrh má prázdný obsah nebo neznámou složku. Nic se neuložilo.")
        if note.operation == "update":
            if note.noteId not in complete_ids or note.noteId in targets:
                raise ProviderError("Přepis odmítnut: cílová poznámka není úplná nebo je v návrhu vícekrát. Nic se neuložilo.")
            targets.add(note.noteId)
        elif note.noteId:
            raise ProviderError("Nová poznámka nesmí přepisovat existující ID. Nic se neuložilo.")
        actions.append({"type": "create_note" if note.operation == "create" else "update_note", **({"noteId": note.noteId} if note.operation == "update" else {}), "title": note.title.strip(), "folder": note.folder, "content": note.content, "knowledgeNote": True})
    return actions
