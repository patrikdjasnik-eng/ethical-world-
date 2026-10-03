import type { Note } from "../types";

export interface MarkdownFile {
  relativePath: string;
  content: string;
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
  provider: "local-markdown" | "github" | "notion" = "local-markdown"
): Note[] {
  const bySource = new Map<string, Note>();

  for (const note of existingNotes) {
    if (note.source?.provider === provider && note.source.connectionId === connectionId) {
      bySource.set(note.source.relativePath.toLocaleLowerCase("en-US"), note);
    }
  }

  const timestamp = new Date().toISOString();

  return files
    .filter((file) => /\.(md|mdx)$/i.test(file.relativePath))
    .map((file) => {
      const relativePath = normalizeRelativePath(file.relativePath);
      const parts = relativePath.split("/");
      const fileName = parts.pop() ?? "Untitled.md";
      const folder = parts.join("/");
      const previous = bySource.get(relativePath.toLocaleLowerCase("en-US"));

      return {
        id: previous?.id ?? crypto.randomUUID(),
        title: stripMarkdownExtension(fileName) || "Untitled",
        content: file.content,
        folder,
        createdAt: previous?.createdAt ?? timestamp,
        updatedAt: timestamp,
        source: {
          provider,
          connectionId,
          relativePath
        }
      };
    });
}

export function notesToMarkdownFiles(
  notes: Note[],
  connectionId: string,
  provider: "local-markdown" | "github" | "notion" = "local-markdown"
): MarkdownFile[] {
  const usedPaths = new Set<string>();

  return notes.map((note) => {
    const preferredPath = note.source?.provider === provider &&
      note.source.connectionId === connectionId
      ? normalizeRelativePath(note.source.relativePath)
      : "";

    const folder = note.folder
      .split("/")
      .map(safeFileSegment)
      .filter(Boolean)
      .join("/");

    const fallbackBase = safeFileSegment(note.title) + ".md";
    let relativePath = preferredPath || (folder ? folder + "/" + fallbackBase : fallbackBase);
    let counter = 2;

    while (usedPaths.has(relativePath.toLocaleLowerCase("en-US"))) {
      const extension = /\.mdx$/i.test(relativePath) ? ".mdx" : ".md";
      const stem = relativePath.slice(0, -extension.length);
      relativePath = stem + "-" + counter + extension;
      counter += 1;
    }

    usedPaths.add(relativePath.toLocaleLowerCase("en-US"));
    return { relativePath, content: note.content };
  });
}
