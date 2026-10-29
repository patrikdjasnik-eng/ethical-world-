import { describe, expect, it } from "vitest";
import {
  buildFolderTree,
  inferFoldersFromNotes,
  joinFolderPath,
  renameFolderPath,
  sanitizeFolderName
} from "../src/lib/folders";
import type { Note } from "../src/types";

const timestamp = "2026-10-03T00:00:00.000Z";

const notes: Note[] = [
  {
    id: "1",
    title: "Root note",
    content: "",
    folder: "",
    createdAt: timestamp,
    updatedAt: timestamp
  },
  {
    id: "2",
    title: "Nested note",
    content: "",
    folder: "Projects/GoodFeel",
    createdAt: timestamp,
    updatedAt: timestamp
  }
];

describe("folder paths", () => {
  it("sanitizes folder names", () => {
    expect(sanitizeFolderName("  My:Folder / Test  ")).toBe("My Folder Test");
  });

  it("joins nested folder paths", () => {
    expect(joinFolderPath("Projects", "GoodFeel")).toBe("Projects/GoodFeel");
    expect(joinFolderPath(null, "Inbox")).toBe("Inbox");
  });

  it("renames a whole path prefix", () => {
    expect(renameFolderPath("Projects/GoodFeel/Ideas", "Projects/GoodFeel", "Projects/GF"))
      .toBe("Projects/GF/Ideas");
  });
});

describe("folder tree", () => {
  it("infers nested folders from legacy notes", () => {
    const folders = inferFoldersFromNotes(notes);
    expect(folders.map((folder) => folder.path).sort()).toEqual(["Projects", "Projects/GoodFeel"]);
  });

  it("places notes into root and nested folders", () => {
    const folders = inferFoldersFromNotes(notes);
    const tree = buildFolderTree(folders, notes);

    expect(tree.rootNotes.map((note) => note.id)).toEqual(["1"]);
    expect(tree.roots[0].children[0].notes.map((note) => note.id)).toEqual(["2"]);
  });
});
