import { describe, expect, it } from "vitest";
import { parseAgentResponse, validateAgentAction } from "../src/lib/agentTools";

const fence = String.fromCharCode(96).repeat(3);

describe("Máša agent action protocol", () => {
  it("extracts a valid create note action and hides machine data from chat", () => {
    const raw = "Jasně, připravila jsem poznámku.\n\n" +
      fence + "ethical-actions\n" +
      '[{"type":"create_note","title":"Nmap notes","content":"# Nmap","folder":"Cyber"}]' +
      "\n" + fence;

    const result = parseAgentResponse(raw);

    expect(result.content).toBe("Jasně, připravila jsem poznámku.");
    expect(result.actions).toEqual([
      { type: "create_note", title: "Nmap notes", content: "# Nmap", folder: "Cyber" }
    ]);
  });

  it("rejects destructive or unknown actions", () => {
    expect(validateAgentAction({ type: "delete_note", noteId: "1" })).toBeNull();
    expect(validateAgentAction({ type: "shell", command: "rm -rf ." })).toBeNull();
  });

  it("rejects an empty update", () => {
    expect(validateAgentAction({ type: "update_note", noteId: "1" })).toBeNull();
  });

  it("keeps valid actions when unsupported actions share the block", () => {
    const raw = "Hotovo.\n\n" + fence + "ethical-actions\n" +
      '[{"type":"open_note","noteId":"note-1"},{"type":"delete_note","noteId":"note-2"}]' +
      "\n" + fence;

    const result = parseAgentResponse(raw);
    expect(result.actions).toEqual([{ type: "open_note", noteId: "note-1" }]);
  });

  it("never executes malformed JSON", () => {
    const result = parseAgentResponse("Text\n\n" + fence + "ethical-actions\n[{bad}]\n" + fence);
    expect(result.actions).toEqual([]);
  });
});
