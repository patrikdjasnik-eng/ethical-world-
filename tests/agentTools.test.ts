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


describe("Máša knowledge note protocol", () => {
  it("keeps raw Mermaid and Prisma blocks and adds badges", () => {
    const raw = [
      "Připravil jsem kompletní poznámku.",
      "<ethical-note>",
      '{"action":"create","title":"Identity Architecture","folder":"Cyber"}',
      "<content>",
      "# Identity Architecture",
      "",
      fence + "mermaid",
      "flowchart LR",
      "  A --> B",
      fence,
      "",
      fence + "prisma",
      "model User {",
      "  id String @id",
      "}",
      fence,
      "",
      "Navazuje na [[OAuth Basics]] a [[Neexistující poznámka]].",
      "</content>",
      "</ethical-note>"
    ].join("\n");

    const result = parseAgentResponse(raw, [
      {
        id: "oauth",
        title: "OAuth Basics",
        content: "",
        folder: "Cyber",
        createdAt: "2026-10-03T00:00:00.000Z",
        updatedAt: "2026-10-03T00:00:00.000Z"
      }
    ]);

    expect(result.content).toBe("Připravil jsem kompletní poznámku.");
    expect(result.actions).toHaveLength(1);

    const action = result.actions[0];
    expect(action.type).toBe("create_note");

    if (action.type !== "create_note") throw new Error("Expected create_note");

    expect(action.knowledgeNote).toBe(true);
    expect(action.content).toContain("img.shields.io/badge/Ethical_World-Knowledge");
    expect(action.content).toContain(fence + "mermaid");
    expect(action.content).toContain(fence + "prisma");
    expect(action.content).toContain("[[OAuth Basics]]");
    expect(action.content).not.toContain("[[Neexistující poznámka]]");
    expect(action.content).toContain("Neexistující poznámka");
  });

  it("supports full-note updates through the raw Markdown envelope", () => {
    const raw = [
      "<ethical-note>",
      '{"action":"update","noteId":"note-1","title":"Nmap","folder":"Cyber"}',
      "<content>",
      "# Nmap",
      "",
      "Updated body.",
      "</content>",
      "</ethical-note>"
    ].join("\n");

    const result = parseAgentResponse(raw);
    expect(result.actions[0]).toMatchObject({
      type: "update_note",
      noteId: "note-1",
      title: "Nmap",
      knowledgeNote: true
    });
  });
});
