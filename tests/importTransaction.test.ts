// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { beforeEach, expect, it } from "vitest";
import { listNotes, saveImportedWorkspace, saveNote } from "../src/lib/storage";
import type { Note } from "../src/types";

const original: Note = { id: "cas", title: "Original", folder: "", content: "baseline", createdAt: "same", updatedAt: "same" };
beforeEach(async () => {
  await new Promise<void>((resolve) => { const request = indexedDB.deleteDatabase("ethical-world"); request.onsuccess = () => resolve(); });
  await saveNote(original);
});
it("rejects a concurrent-tab edit even when its timestamp did not change", async () => {
  await saveNote({ ...original, content: "other tab" });
  await expect(saveImportedWorkspace([{ ...original, content: "remote" }], [], [original], () => true)).rejects.toThrow(/Konflikt/);
  expect((await listNotes())[0].content).toBe("other tab");
});
it("rejects an in-memory edit at the transactional compare boundary", async () => {
  await expect(saveImportedWorkspace([{ ...original, content: "remote" }], [], [original], () => false)).rejects.toThrow(/Konflikt/);
  expect((await listNotes())[0].content).toBe("baseline");
});
