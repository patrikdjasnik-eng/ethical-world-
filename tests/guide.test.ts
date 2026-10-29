import { describe, expect, it } from "vitest";
import { guideSections, productUpdates } from "../src/content/guide";

describe("product guide", () => {
  it("keeps Czech and English guide sections available", () => {
    expect(guideSections.cs.length).toBeGreaterThan(0);
    expect(guideSections.en.length).toBe(guideSections.cs.length);
  });

  it("keeps update entries bilingual", () => {
    expect(productUpdates.length).toBeGreaterThan(0);
    for (const update of productUpdates) {
      expect(update.title.cs).toBeTruthy();
      expect(update.title.en).toBeTruthy();
      expect(update.items.cs.length).toBeGreaterThan(0);
      expect(update.items.en.length).toBeGreaterThan(0);
    }
  });
});
