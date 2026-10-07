// @vitest-environment jsdom
import { beforeEach, expect, it } from "vitest";
import { loadAiSettings, saveAiSettings } from "../src/lib/aiSettings";

beforeEach(() => localStorage.clear());
it("preserves the chosen model and style but never persists the API key", () => {
  saveAiSettings({ provider: "openai-compatible", model: "chosen", baseUrl: "https://api.openai.com/v1", apiKey: "secret", responseStyle: "detailed" });
  expect(localStorage.getItem("ethical-world.ai-settings.v1")).not.toContain("secret");
  expect(loadAiSettings()).toEqual({ provider: "openai-compatible", model: "chosen", baseUrl: "https://api.openai.com/v1", apiKey: "", responseStyle: "detailed" });
});
it("does not persist credentials embedded in a provider URL", () => {
  saveAiSettings({ provider: "ollama", model: "demo", baseUrl: "http://user:secret@localhost:11434", apiKey: "" });
  expect(localStorage.length).toBe(0);
});
