import type { Note } from "../types";

export function normalizeTitle(value: string): string {
  return value.trim().toLocaleLowerCase("cs-CZ");
}

export function extractWikiLinks(content: string): string[] {
  const matches = content.matchAll(/\[\[([^\]]+)\]\]/g);
  return Array.from(new Set(Array.from(matches, (match) => match[1].trim()).filter(Boolean)));
}

export function getBacklinks(notes: Note[], targetTitle: string): Note[] {
  const normalizedTarget = normalizeTitle(targetTitle);

  return notes.filter((note) =>
    extractWikiLinks(note.content).some((link) => normalizeTitle(link) === normalizedTarget)
  );
}

export function searchNotes(notes: Note[], query: string): Note[] {
  const normalizedQuery = query.trim().toLocaleLowerCase("cs-CZ");

  if (!normalizedQuery) {
    return notes;
  }

  return notes.filter((note) =>
    `${note.title}\n${note.content}\n${note.folder}`
      .toLocaleLowerCase("cs-CZ")
      .includes(normalizedQuery)
  );
}

export function createEmptyNote(title = "Nová poznámka", folder = ""): Note {
  const timestamp = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    title,
    content: "# Nová poznámka\n\nZačni psát…",
    folder,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}
