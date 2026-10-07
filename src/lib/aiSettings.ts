import type { AiSettings } from "../types";

const key = "ethical-world.ai-settings.v1";
export const defaultAiSettings: AiSettings = {
  provider: "ollama", model: "masa-cyber", baseUrl: "http://localhost:11434", apiKey: "", responseStyle: "fast"
};

export function hasSavedAiSettings(): boolean {
  try { return localStorage.getItem(key) !== null; } catch { return false; }
}

export function loadAiSettings(): AiSettings {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? "null");
    if (!value || !["ollama", "openai-compatible"].includes(value.provider) || typeof value.model !== "string" || !value.model || value.model.length > 200 || typeof value.baseUrl !== "string" || value.baseUrl.length > 500) return { ...defaultAiSettings };
    const url = new URL(value.baseUrl);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) return { ...defaultAiSettings };
    return { provider: value.provider, model: value.model, baseUrl: value.baseUrl, apiKey: "", responseStyle: ["fast", "balanced", "detailed"].includes(value.responseStyle) ? value.responseStyle : "fast" };
  } catch { return { ...defaultAiSettings }; }
}

export function saveAiSettings(settings: AiSettings): void {
  try {
    const url = new URL(settings.baseUrl);
    if (url.username || url.password || url.search || url.hash) return;
    const { provider, model, baseUrl, responseStyle } = settings;
    localStorage.setItem(key, JSON.stringify({ provider, model, baseUrl, responseStyle }));
  } catch { /* Settings remain usable in memory when persistence is unavailable. */ }
}
