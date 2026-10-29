import type { Note, NoteSourceProvider } from "../types";

export interface MarkdownFile {
  relativePath: string;
  content: string;
  incomplete?: boolean;
}

export interface ExportReceipt {
  note: Note;
  provider: "local-markdown" | "github" | "notion";
  connectionId: string;
  relativePath: string;
}

function normalizeRelativePath(value: string): string {
  return value
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .split("/")
    .filter((part) => part && part !== "." && part !== "..")
    .join("/");
}

function stripMarkdownExtension(fileName: string): string {
  return fileName.replace(/\.(md|mdx)$/i, "");
}

function safeFileSegment(value: string): string {
  const cleaned = value.replace(/[\\/:*?"<>|]/g, " ").replace(/\s+/g, " ").trim();
  return cleaned || "Untitled";
}

export function markdownFilesToNotes(
  files: MarkdownFile[],
  connectionId: string,
  existingNotes: Note[],
  provider: NoteSourceProvider = "local-markdown"
): Note[] {
  const bySource = new Map<string, Note>();
  const sourceKey = (path: string) => provider !== "local-markdown"
    ? path
    : path.toLocaleLowerCase("en-US");

  for (const note of existingNotes) {
    if (note.source?.provider === provider && note.source.connectionId === connectionId) {
      const key = sourceKey(note.source.relativePath);
      if (bySource.has(key)) throw new Error("Kolize cest importu: „" + note.source.relativePath + "“. Nejdřív přejmenuj soubory lišící se pouze velikostí písmen.");
      bySource.set(key, note);
    }
  }

  const timestamp = new Date().toISOString();
  const seen = new Set<string>();

  return files
    .filter((file) => /\.(md|mdx)$/i.test(file.relativePath))
    .map((file) => {
      const relativePath = normalizeRelativePath(file.relativePath);
      const key = sourceKey(relativePath);
      if (seen.has(key)) throw new Error("Kolize cest importu: „" + relativePath + "“. Žádná poznámka nebyla přepsána.");
      seen.add(key);
      const parts = relativePath.split("/");
      const fileName = parts.pop() ?? "Untitled.md";
      const folder = parts.join("/");
      const previous = bySource.get(sourceKey(relativePath));
      if (file.incomplete && previous && !previous.source?.incomplete) {
        throw new Error("Neúplný import nesmí nahradit úplnou poznámku „" + previous.title + "“.");
      }

      if (previous?.source?.baselineContent !== undefined &&
          previous.content !== previous.source.baselineContent &&
          file.content !== previous.content) {
        throw new Error("Konflikt importu: „" + relativePath + "“ má neexportované lokální změny.");
      }

      return {
        id: previous?.id ?? crypto.randomUUID(),
        title: previous?.title ?? (stripMarkdownExtension(fileName) || "Untitled"),
        content: file.content,
        folder: previous?.folder ?? folder,
        createdAt: previous?.createdAt ?? timestamp,
        updatedAt: timestamp,
        source: {
          provider,
          connectionId,
          relativePath,
          baselineContent: file.incomplete ? undefined : file.content,
          incomplete: file.incomplete ?? false
        }
      };
    });
}

export function notesToMarkdownFiles(
  notes: Note[],
  connectionId: string,
  provider: NoteSourceProvider = "local-markdown"
): MarkdownFile[] {
  const usedPaths = new Set<string>();

  return notes.map((note) => {
    const preferredPath = note.source?.provider === provider &&
      note.source.connectionId === connectionId
      ? normalizeRelativePath(note.source.relativePath)
      : "";

    const folder = note.folder
      .split("/")
      .filter((part) => part.trim().length > 0)
      .map(safeFileSegment)
      .join("/");

    const fallbackBase = safeFileSegment(note.title) + ".md";
    let relativePath = preferredPath || (folder ? folder + "/" + fallbackBase : fallbackBase);
    let counter = 2;

    while (usedPaths.has(provider === "github" ? relativePath : relativePath.toLocaleLowerCase("en-US"))) {
      const extension = /\.mdx$/i.test(relativePath) ? ".mdx" : ".md";
      const stem = relativePath.slice(0, -extension.length);
      relativePath = stem + "-" + counter + extension;
      counter += 1;
    }

    usedPaths.add(provider === "github" ? relativePath : relativePath.toLocaleLowerCase("en-US"));
    return { relativePath, content: note.content };
  });
}
