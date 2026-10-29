import { describe, expect, it } from "vitest";
import { mermaidSourceFromCode, normalizeMermaidSource } from "../src/lib/mermaid";

describe("Mermaid Markdown detection", () => {
  it("recognizes fenced Mermaid code", () => {
    expect(mermaidSourceFromCode("language-mermaid", "flowchart LR\nA --> B\n"))
      .toBe("flowchart LR\nA --> B");
  });

  it("does not hijack other code blocks", () => {
    expect(mermaidSourceFromCode("language-typescript", "const x = 1;")).toBeNull();
  });

  it("normalizes line endings", () => {
    expect(normalizeMermaidSource("sequenceDiagram\r\nA->>B: ahoj\r\n"))
      .toBe("sequenceDiagram\nA->>B: ahoj");
  });

  it("rejects empty and oversized Mermaid blocks", () => {
    expect(mermaidSourceFromCode("language-mermaid", "   ")).toBeNull();
    expect(mermaidSourceFromCode("language-mermaid", "x".repeat(50_001))).toBeNull();
  });
});
