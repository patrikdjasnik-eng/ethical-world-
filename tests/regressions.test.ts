import { describe, expect, it } from "vitest";
import { markdownFilesToNotes, notesToMarkdownFiles } from "../src/lib/markdownConnector";
import { NoteWriteQueue } from "../src/lib/notePersistence";
import type { Note } from "../src/types";

const note = (id: string, content = "old"): Note => ({
  id, title: id, content, folder: "", createdAt: "2026-10-06T00:00:00Z", updatedAt: "2026-10-06T00:00:00Z"
});

describe("connector and persistence regressions", () => {
  it("keeps case-sensitive GitHub source identities across repeated imports", () => {
    const files = [{ relativePath: "README.md", content: "upper" }, { relativePath: "readme.md", content: "lower" }];
    const first = markdownFilesToNotes(files, "repo", [], "github");
    const second = markdownFilesToNotes(files, "repo", first, "github");
    expect(new Set(second.map((item) => item.id)).size).toBe(2);
    expect(second.map((item) => item.id)).toEqual(first.map((item) => item.id));
  });

  it("exports root notes to root and rejects stale reimport", () => {
    expect(notesToMarkdownFiles([note("root")], "local")[0].relativePath).toBe("root.md");
    const [imported] = markdownFilesToNotes([{ relativePath: "one.md", content: "baseline" }], "local", []);
    imported.content = "local edit";
    expect(() => markdownFilesToNotes([{ relativePath: "one.md", content: "remote edit" }], "local", [imported])).toThrow(/Konflikt/);
  });

  it("saves both notes during fast switching and recovers after a write failure", async () => {
    const stored = new Map<string, string>();
    let fail = true;
    const queue = new NoteWriteQueue(async (item) => {
      if (fail) { fail = false; throw new Error("quota"); }
      stored.set(item.id, item.content);
    });
    await expect(queue.enqueue(note("one"))).rejects.toThrow("quota");
    await Promise.all([queue.enqueue(note("one", "latest edit")), queue.enqueue(note("two", "other"))]);
    await queue.flush();
    expect(stored.get("one")).toBe("latest edit");
    expect(stored.get("two")).toBe("other");
  });
});
