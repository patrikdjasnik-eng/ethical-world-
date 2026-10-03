import { describe, expect, it } from "vitest";
import { extractWikiLinks, getBacklinks, searchNotes } from "../src/lib/notes";
import type { Note } from "../src/types";

const notes: Note[] = [
  {
    id: "1",
    title: "GoodFeel",
    content: "Social network notes",
    folder: "Projects",
    createdAt: "2026-10-03T00:00:00.000Z",
    updatedAt: "2026-10-03T00:00:00.000Z"
  },
  {
    id: "2",
    title: "Roadmap",
    content: "Continue with [[GoodFeel]] and [[Rabbit Reads]].",
    folder: "Planning",
    createdAt: "2026-10-03T00:00:00.000Z",
    updatedAt: "2026-10-03T00:00:00.000Z"
  }
];

describe("wiki links", () => {
  it("extracts unique links", () => {
    expect(extractWikiLinks("[[Alpha]] [[Beta]] [[Alpha]]")).toEqual(["Alpha", "Beta"]);
  });

  it("finds backlinks case-insensitively", () => {
    expect(getBacklinks(notes, "goodfeel").map((note) => note.id)).toEqual(["2"]);
  });
});

describe("search", () => {
  it("searches title, content and folder", () => {
    expect(searchNotes(notes, "planning").map((note) => note.id)).toEqual(["2"]);
    expect(searchNotes(notes, "social network").map((note) => note.id)).toEqual(["1"]);
  });
});
