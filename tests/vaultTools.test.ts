import { describe, expect, it } from "vitest";
import { actionPreview, changedNote, findRelatedNotes, readNote, searchNotes } from "../src/lib/vaultTools";
import { parseAgentResponse, validateAgentAction } from "../src/lib/agentTools";
import type { Note } from "../src/types";

const first: Note = { id: "a", title: "Network", content: "DNS and TCP", folder: "", createdAt: "old", updatedAt: "old" };
const other: Note = { ...first, id: "b", title: "DNS", content: "[[Network]]" };

describe("Máša vault tools", () => {
  it("retrieves relevant older content and resolves related links", () => {
    expect(searchNotes([first, other], "DNS")[0].id).toBe("b");
    expect(findRelatedNotes([first, other], "a").map((note) => note.id)).toContain("b");
    expect(readNote([first], "a")).toEqual(first);
    expect(() => readNote([], "a")).toThrow();
  });
  it("renames, moves, links and adds tasks without dropping original content", () => {
    expect(changedNote({ type: "rename_note", noteId: "a", title: "New" }, [first])?.title).toBe("New");
    expect(changedNote({ type: "move_note", noteId: "a", folder: "Lab" }, [first])?.folder).toBe("Lab");
    expect(changedNote({ type: "create_task", noteId: "a", text: "Retest" }, [first])?.content).toBe("DNS and TCP\n\n- [ ] Retest");
    expect(changedNote({ type: "link_notes", noteId: "a", targetNoteId: "b" }, [first, other])?.content).toContain("[[DNS]]");
    expect(actionPreview({ type: "rename_note", noteId: "a", title: "New" }, [first])).toContain("Po: root/New");
  });
  it("rejects stale proposals and ambiguous wiki links", () => {
    expect(() => changedNote({ type: "update_note", noteId: "a", content: "lost", expectedUpdatedAt: "old" }, [{ ...first, updatedAt: "new" }])).toThrow("změnila");
    expect(() => changedNote({ type: "link_notes", noteId: "a", targetNoteId: "b" }, [first, other, { ...other, id: "c" }])).toThrow("jedinečný");
  });
  it("validates new actions and attaches the proposal baseline", () => {
    const block = '```ethical-actions\n[{"type":"create_task","noteId":"a","text":"Retest"}]\n```';
    expect(parseAgentResponse(block, [first]).actions[0]).toMatchObject({ type: "create_task", expectedUpdatedAt: "old" });
    expect(validateAgentAction({ type: "create_task", noteId: "a", text: "bad\nline" })).toBeNull();
    expect(validateAgentAction({ type: "move_note", noteId: "a", folder: "" })).toMatchObject({ folder: "" });
    expect(validateAgentAction({ type: "delete_note", noteId: "a" })).toBeNull();
  });
});
