import { describe, expect, it } from "vitest";
import { markdownFilesToNotes, notesToMarkdownFiles } from "../src/lib/markdownConnector";
import type { Note } from "../src/types";

describe("markdown connector", () => {
  it("imports markdown paths as folders and titles", () => {
    const notes = markdownFilesToNotes(
      [{ relativePath: "Cyber/Nmap.md", content: "# Nmap" }],
      "local-1",
      []
    );

    expect(notes).toHaveLength(1);
    expect(notes[0].title).toBe("Nmap");
    expect(notes[0].folder).toBe("Cyber");
    expect(notes[0].source?.relativePath).toBe("Cyber/Nmap.md");
  });

  it("reuses the note id on repeated import from the same source", () => {
    const existing: Note = {
      id: "existing",
      title: "Nmap",
      content: "old",
      folder: "Cyber",
      createdAt: "2026-10-03T00:00:00.000Z",
      updatedAt: "2026-10-03T00:00:00.000Z",
      source: {
        provider: "local-markdown",
        connectionId: "local-1",
        relativePath: "Cyber/Nmap.md"
      }
    };

    const [next] = markdownFilesToNotes(
      [{ relativePath: "Cyber/Nmap.md", content: "new" }],
      "local-1",
      [existing]
    );

    expect(next.id).toBe("existing");
    expect(next.content).toBe("new");
  });

  it("preserves original source path when exporting", () => {
    const note: Note = {
      id: "1",
      title: "Renamed in UI",
      content: "# body",
      folder: "Cyber",
      createdAt: "2026-10-03T00:00:00.000Z",
      updatedAt: "2026-10-03T00:00:00.000Z",
      source: {
        provider: "local-markdown",
        connectionId: "local-1",
        relativePath: "Docs/original.md"
      }
    };

    expect(notesToMarkdownFiles([note], "local-1")).toEqual([
      { relativePath: "Docs/original.md", content: "# body" }
    ]);
  });
});
