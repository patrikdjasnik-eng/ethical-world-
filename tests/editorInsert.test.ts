import { describe, expect, it } from "vitest";
import { applyMarkdownInsert } from "../src/lib/editorInsert";

describe("markdown insert helpers", () => {
  it("inserts a wiki link at the caret", () => {
    const result = applyMarkdownInsert("Ahoj ", 5, 5, { kind: "wiki-link", title: "Nmap" });
    expect(result.content).toBe("Ahoj [[Nmap]]");
    expect(result.selectionStart).toBe(result.content.length);
  });

  it("wraps a selection in a fenced code block", () => {
    const result = applyMarkdownInsert("ipconfig", 0, 8, { kind: "code", language: "powershell" });
    expect(result.content).toBe("```powershell\nipconfig\n```");
  });

  it("places the caret inside an empty fenced code block", () => {
    const result = applyMarkdownInsert("", 0, 0, { kind: "code", language: "bash" });
    expect(result.content).toBe("```bash\n\n```");
    expect(result.selectionStart).toBe("```bash\n".length);
  });

  it("creates tasks from every selected line", () => {
    const result = applyMarkdownInsert("scan\nreport", 0, 11, { kind: "task" });
    expect(result.content).toBe("- [ ] scan\n- [ ] report");
  });

  it("creates a callout around selected content", () => {
    const result = applyMarkdownInsert("Pozor", 0, 5, { kind: "callout", calloutType: "WARNING" });
    expect(result.content).toBe("> [!WARNING]\n> Pozor");
  });
});
