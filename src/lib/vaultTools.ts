import type { AgentAction, Note } from "../types";

const tokens = (value: string): string[] => value.toLocaleLowerCase("cs-CZ").match(/[\p{L}\p{N}_-]{2,}/gu) ?? [];

export function searchNotes(notes: Note[], query: string, limit = 20): Note[] {
  const terms = [...new Set(tokens(query))];
  if (!terms.length) return [];
  return notes.map((note) => {
    const title = note.title.toLocaleLowerCase("cs-CZ");
    const body = note.content.toLocaleLowerCase("cs-CZ");
    const score = terms.reduce((sum, term) => sum + (title.includes(term) ? 8 : 0) + (body.includes(term) ? 1 : 0), 0);
    return { note, score };
  }).filter(({ score }) => score > 0).sort((a, b) => b.score - a.score || a.note.id.localeCompare(b.note.id)).slice(0, limit).map(({ note }) => note);
}

export function readNote(notes: Note[], id: string): Note {
  const note = notes.find((candidate) => candidate.id === id);
  if (!note) throw new Error("Poznámka už neexistuje.");
  return note;
}

export function findRelatedNotes(notes: Note[], id: string): Note[] {
  const note = readNote(notes, id);
  const linked = notes.filter((candidate) => candidate.id !== id && (note.content.includes(`[[${candidate.title}]]`) || candidate.content.includes(`[[${note.title}]]`)));
  return [...new Map([...linked, ...searchNotes(notes.filter((candidate) => candidate.id !== id), note.title + " " + note.content.slice(0, 1000), 10)].map((candidate) => [candidate.id, candidate])).values()].slice(0, 10);
}

export function changedNote(action: AgentAction, notes: Note[]): Note | null {
  if (!("noteId" in action) || action.type === "open_note") return null;
  const note = readNote(notes, action.noteId);
  if ((action.expectedUpdatedAt && note.updatedAt !== action.expectedUpdatedAt) || (action.expectedSnapshot && action.expectedSnapshot !== JSON.stringify([note.title, note.folder, note.content]))) {
    throw new Error("Poznámka se od návrhu změnila. Nech Mášu připravit nový návrh.");
  }
  let title = note.title;
  let content = note.content;
  let folder = note.folder;
  if (action.type === "update_note") {
    title = action.title === undefined ? title : action.title.trim() || title;
    content = action.content ?? content;
    folder = action.folder ?? folder;
  } else if (action.type === "rename_note") title = action.title;
  else if (action.type === "move_note") folder = action.folder;
  else if (action.type === "create_task") content += `\n\n- [ ] ${action.text}`;
  else if (action.type === "link_notes") {
    const target = readNote(notes, action.targetNoteId);
    if (target.id === note.id || /[\[\]\r\n|]/.test(target.title) || notes.filter((candidate) => candidate.title === target.title).length !== 1) {
      throw new Error("Cíl wiki odkazu musí mít jedinečný název bez speciálních znaků.");
    }
    const link = `[[${target.title}]]`;
    if (!content.includes(link)) content += `\n\n${link}`;
  }
  return { ...note, title, content, folder, updatedAt: new Date().toISOString() };
}

export function actionPreview(action: AgentAction, notes: Note[]): string {
  if (action.type === "create_folder") return `Nová složka: ${action.parentPath ? action.parentPath + "/" : ""}${action.name}`;
  if (action.type === "create_note") return `Nová poznámka: ${action.folder || "root"}/${action.title}\n\n${action.content}`;
  if (action.type === "open_note") return `Otevřít: ${readNote(notes, action.noteId).title}`;
  const before = readNote(notes, action.noteId);
  const after = changedNote(action, notes)!;
  return `Před: ${before.folder || "root"}/${before.title}\nPo: ${after.folder || "root"}/${after.title}\n\nPŮVODNÍ OBSAH\n${before.content}\n\nNAVRŽENÝ OBSAH\n${after.content}`;
}
