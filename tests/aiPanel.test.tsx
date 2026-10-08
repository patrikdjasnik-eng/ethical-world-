// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import AiPanel from "../src/components/AiPanel";
import { autoDetectLocalProvider, checkGatewayHealth, checkProviderStatus, sendAiMessage } from "../src/lib/ai";
import { listAgentAudit } from "../src/lib/storage";
import type { AgentAction, Note } from "../src/types";
import type { EthicalDesktopApi } from "../src/types/desktop";
import { saveAiSettings } from "../src/lib/aiSettings";

vi.mock("../src/lib/ai", () => ({
  checkGatewayHealth: vi.fn(async () => true),
  autoDetectLocalProvider: vi.fn(async () => ({ online: true, provider: "ollama", model: "fixture", models: ["fixture"], baseUrl: "http://localhost:11434" })),
  checkProviderStatus: vi.fn(async () => ({ online: true, model: "fixture", models: ["fixture"] })),
  sendAiMessage: vi.fn()
}));
const note: Note = { id: "a", title: "Original", content: "preserve", folder: "", createdAt: "old", updatedAt: "old" };
const apply = vi.fn(async (_action: AgentAction) => "provedeno");
const block = (actions: unknown[]) => '```ethical-actions\n' + JSON.stringify(actions) + '\n```';
beforeEach(async () => {
  vi.clearAllMocks();
  localStorage.clear();
  Element.prototype.scrollIntoView = vi.fn();
  await new Promise<void>((resolve) => { const request = indexedDB.deleteDatabase("ethical-world"); request.onsuccess = () => resolve(); });
});
afterEach(() => { cleanup(); delete window.ethicalDesktop; vi.restoreAllMocks(); vi.unstubAllGlobals(); });
async function setup() {
  render(<AiPanel notes={[note]} activeNote={note} folders={[{ id: "f", path: "Lab", name: "Lab", parentPath: null, createdAt: "old", updatedAt: "old" }]} visible onRequestHide={() => {}} onApplyAgentAction={apply} />);
  await screen.findByText(/Online · fixture/);
}
function send() {
  fireEvent.change(screen.getByPlaceholderText("Řekni Máše, co má v Ethical World udělat…"), { target: { value: "udělej poznámku" } });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
}

it("retries the application backend from the offline banner before checking the model", async () => {
  const ensure = vi.fn()
    .mockResolvedValueOnce({ state: "error", source: "offline", message: "Backend se nepodařilo načíst." })
    .mockResolvedValue({ state: "ready", source: "bundled", message: "ready" });
  window.ethicalDesktop = { ensureBackendRuntime: ensure } as unknown as EthicalDesktopApi;
  render(<AiPanel notes={[]} activeNote={null} folders={[]} visible onRequestHide={() => {}} onApplyAgentAction={apply} />);
  await screen.findByText("Backend se nepodařilo načíst.");
  expect(checkGatewayHealth).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Zkontrolovat znovu" }));
  await screen.findByText(/Online · fixture/);
  expect(ensure).toHaveBeenCalledTimes(2);
});

it("preserves the draft when backend preparation fails and retries it before sending", async () => {
  const ensure = vi.fn()
    .mockResolvedValueOnce({ state: "ready", source: "bundled", message: "ready" })
    .mockResolvedValueOnce({ state: "error", source: "offline", message: "Backend není připravený." })
    .mockResolvedValue({ state: "ready", source: "bundled", message: "ready" });
  window.ethicalDesktop = { ensureBackendRuntime: ensure } as unknown as EthicalDesktopApi;
  vi.mocked(sendAiMessage).mockResolvedValue({ content: "Hotovo", provider: "ollama", model: "fixture", completeNoteIds: [] });
  await setup();
  send();
  await screen.findByText("Backend není připravený.");
  const input = screen.getByPlaceholderText("Řekni Máše, co má v Ethical World udělat…") as HTMLTextAreaElement;
  expect(input.value).toBe("udělej poznámku");
  expect(sendAiMessage).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  await waitFor(() => expect(sendAiMessage).toHaveBeenCalledTimes(1));
  expect(ensure).toHaveBeenCalledTimes(3);
});

it("prepares the saved local model on reopening without switching to a probe's default model", async () => {
  saveAiSettings({ provider: "ollama", model: "chosen", baseUrl: "http://localhost:11434", apiKey: "", responseStyle: "balanced" });
  const ensure = vi.fn(async () => ({ state: "ready" as const, model: "chosen:latest", message: "ready" }));
  window.ethicalDesktop = { ensureLocalModel: ensure } as unknown as EthicalDesktopApi;
  vi.mocked(checkProviderStatus).mockResolvedValueOnce({ online: true, provider: "ollama", models: ["fixture", "chosen:latest"], model: "fixture", baseUrl: "http://localhost:11434" });
  render(<AiPanel notes={[]} activeNote={null} folders={[]} visible onRequestHide={() => {}} onApplyAgentAction={apply} />);
  await screen.findByText(/Online · chosen:latest/);
  expect(ensure).toHaveBeenCalledWith({ model: "chosen", baseUrl: "http://localhost:11434", warmup: false });
  expect(autoDetectLocalProvider).not.toHaveBeenCalled();
});

it("sends after service validation without warmup and measures preparation separately from provider time", async () => {
  let clock = 0;
  vi.spyOn(performance, "now").mockImplementation(() => clock);
  const backend = vi.fn()
    .mockResolvedValueOnce({ state: "ready", source: "bundled", message: "ready" })
    .mockImplementation(async () => { clock = 5000; return { state: "ready", source: "bundled", message: "ready" }; });
  const model = vi.fn()
    .mockResolvedValueOnce({ state: "error", message: "Ollama čeká na start." })
    .mockResolvedValue({ state: "ready", model: "fixture", message: "ready" });
  window.ethicalDesktop = { ensureBackendRuntime: backend, ensureLocalModel: model } as unknown as EthicalDesktopApi;
  vi.mocked(sendAiMessage).mockImplementationOnce(async (input) => {
    expect(backend).toHaveBeenCalledTimes(2);
    expect(model).toHaveBeenLastCalledWith(expect.objectContaining({ warmup: false }));
    clock = 5600;
    input.onProgress?.({ content: "Rychlá odpověď", workload: "chat" });
    clock = 5700;
    return { content: "Rychlá odpověď", provider: "ollama", model: "fixture", completeNoteIds: [], metrics: { elapsedMs: 700, firstTokenMs: 600, inputTokens: 120, outputTokens: 18, tokensPerSecond: 28.5, loadMs: 100, promptMs: 500, generationMs: 100, promptChars: 1500, contextNotes: 0, historyMessages: 1, workload: "chat" } };
  });
  render(<AiPanel notes={[]} activeNote={null} folders={[]} visible onRequestHide={() => {}} onApplyAgentAction={apply} />);
  await screen.findByText("Ollama čeká na start.");
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Ahoj Mášo" } });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  await screen.findByText("Příprava služeb: 5 s · požadavek backendu: 0,7 s");
  expect(screen.getByText("První token v backendu: 0,6 s · první text v chatu: 5,6 s")).toBeTruthy();
  expect(screen.getByText(/Tokeny vstup 120 · výstup 18 · Σ 138 · 5,7 s · 28,5 tok\/s/)).toBeTruthy();
  expect(model).toHaveBeenCalledTimes(2);
});

it("keeps document content in the proposal preview and uses a short chat acknowledgement", async () => {
  const markdown = "# Deep TLS\n\nImportant technical details";
  vi.mocked(sendAiMessage).mockResolvedValue({ content: `Dlouhý duplicitní výpis ${markdown}\n<ethical-note>\n{"action":"create","title":"TLS"}\n<content>\n${markdown}\n</content>\n</ethical-note>`, completeNoteIds: [], provider: "ollama", model: "fixture" });
  await setup(); send();
  await screen.findByText(/Připravila jsem 1 návrh/);
  expect(document.querySelector(".message-list")?.textContent).not.toContain("Important technical details");
  expect(screen.getByText(/Nová poznámka: root\/TLS/).textContent).toContain("Important technical details");
  expect(apply).not.toHaveBeenCalled();
});

it("does not replace a model selected while an earlier service check is pending", async () => {
  let ready!: (value: { state: "ready"; model: string; message: string }) => void;
  const ensure = vi.fn(() => new Promise<{ state: "ready"; model: string; message: string }>((resolve) => { ready = resolve; }));
  window.ethicalDesktop = { ensureLocalModel: ensure } as unknown as EthicalDesktopApi;
  render(<AiPanel notes={[]} activeNote={null} folders={[]} visible onRequestHide={() => {}} onApplyAgentAction={apply} />);
  await waitFor(() => expect(ensure).toHaveBeenCalled());
  fireEvent.click(screen.getByTitle("AI nastavení"));
  fireEvent.change(screen.getByLabelText("Model"), { target: { value: "new-choice" } });
  ready({ state: "ready", model: "masa-cyber:latest", message: "ready" });
  await waitFor(() => expect(screen.getByText(/LLM offline · new-choice/)).toBeTruthy());
  expect((screen.getByLabelText("Model") as HTMLInputElement).value).toBe("new-choice");
});

it("treats raw document output as an unfinished task and keeps it out of chat", async () => {
  vi.mocked(sendAiMessage).mockResolvedValue({ content: "# Raw document\n\nUnattached script content", completeNoteIds: [], provider: "ollama", model: "fixture" });
  await setup(); send();
  await screen.findByText(/Model neposlal platný návrh změny/);
  expect(document.querySelector(".message-list")?.textContent).not.toContain("Unattached script content");
  expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("udělej poznámku");
  expect(apply).not.toHaveBeenCalled();
});

it("does not queue any actions from a token-limited response", async () => {
  vi.mocked(sendAiMessage).mockResolvedValue({ content: block([{ type: "create_note", title: "Partial batch", content: "partial" }]), completeNoteIds: [], provider: "ollama", model: "fixture", metrics: { elapsedMs: 20, inputTokens: null, outputTokens: null, tokensPerSecond: null, loadMs: null, promptMs: null, generationMs: null, promptChars: 100, contextNotes: 0, historyMessages: 1, workload: "document", truncated: true } });
  await setup(); send();
  await screen.findByText(/Odpověď dosáhla tokenového limitu/);
  expect(apply).not.toHaveBeenCalled();
  expect(screen.queryByRole("button", { name: "Použít" })).toBeNull();
  expect(screen.getByText(/Tokeny vstup — · výstup —/)).toBeTruthy();
  expect(screen.getByLabelText("Tokeny konverzace").textContent).toContain("0/1");
});
it("ASSIST previews, confirms once and persists the audit outcome", async () => {
  vi.mocked(sendAiMessage).mockResolvedValue({ content: block([{ type: "rename_note", noteId: "a", title: "New" }]), completeNoteIds: ["a"], provider: "ollama", model: "fixture" });
  await setup(); send();
  await screen.findByText("Náhled změny");
  expect(apply).not.toHaveBeenCalled();
  expect(screen.getByText(/Po: root\/New/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Použít" }));
  await waitFor(() => expect(apply).toHaveBeenCalledTimes(1));
  await waitFor(async () => expect((await listAgentAudit())[0]?.result).toBe("provedeno"));
});
it("READ never queues or applies model actions", async () => {
  vi.mocked(sendAiMessage).mockResolvedValue({ content: block([{ type: "create_note", title: "New", content: "body" }]), completeNoteIds: [], provider: "ollama", model: "fixture" });
  await setup();
  fireEvent.click(screen.getByTitle("AI nastavení"));
  fireEvent.change(screen.getByLabelText("Agent permissions"), { target: { value: "read" } });
  send();
  await waitFor(() => expect(sendAiMessage).toHaveBeenCalled());
  await waitFor(() => expect((screen.getByRole("button", { name: "Send" }) as HTMLButtonElement).disabled).toBe(false));
  expect(screen.queryByRole("button", { name: "Použít" })).toBeNull();
  expect(apply).not.toHaveBeenCalled();
});
it("AGENT requires exact-action approval when a vault note can inject instructions", async () => {
  vi.mocked(sendAiMessage).mockResolvedValue({ content: block([{ type: "create_note", title: "In", folder: "Lab", content: "safe" }, { type: "create_note", title: "Out", folder: "", content: "pending" }]), completeNoteIds: [], provider: "ollama", model: "fixture" });
  await setup();
  fireEvent.click(screen.getByTitle("AI nastavení"));
  fireEvent.change(screen.getByLabelText("Agent permissions"), { target: { value: "agent" } });
  fireEvent.change(screen.getByLabelText("Agent scope"), { target: { value: "Lab" } });
  send();
  await screen.findAllByRole("button", { name: "Použít" });
  expect(apply).not.toHaveBeenCalled();
  fireEvent.click(screen.getAllByRole("button", { name: "Použít" })[0]);
  await waitFor(() => expect(apply).toHaveBeenCalledTimes(1));
  expect(apply.mock.calls[0][0]).toMatchObject({ title: "In" });
});

it("AGENT permits an isolated fresh creation only inside its UI grant", async () => {
  vi.mocked(sendAiMessage).mockResolvedValue({ content: block([{ type: "create_note", title: "In", folder: "Lab", content: "safe" }, { type: "create_note", title: "Out", folder: "", content: "pending", user_confirmed: true, permissionMode: "agent" }]), completeNoteIds: [], provider: "ollama", model: "fixture" });
  render(<AiPanel notes={[]} activeNote={null} folders={[{ id: "f", path: "Lab", name: "Lab", parentPath: null, createdAt: "old", updatedAt: "old" }]} visible onRequestHide={() => {}} onApplyAgentAction={apply} />);
  await screen.findByText(/Online · fixture/);
  fireEvent.click(screen.getByTitle("AI nastavení"));
  fireEvent.change(screen.getByLabelText("Agent permissions"), { target: { value: "agent" } });
  fireEvent.change(screen.getByLabelText("Agent scope"), { target: { value: "Lab" } });
  send();
  await waitFor(() => expect(apply).toHaveBeenCalledTimes(1));
  expect(apply.mock.calls[0][0]).toMatchObject({ title: "In" });
  expect(vi.mocked(sendAiMessage).mock.calls[0][0].messages).toHaveLength(1);
  await screen.findByRole("button", { name: "Použít" });
  fireEvent.change(screen.getByLabelText("Zpráva Máše"), { target: { value: "Další poznámka" } });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  await waitFor(() => expect(sendAiMessage).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(screen.getAllByRole("button", { name: "Použít" })).toHaveLength(3));
  expect(apply).toHaveBeenCalledTimes(1);
});

it("does not retain or execute a rejected instruction echo and restores the draft", async () => {
  const message = "Model začal opisovat interní instrukce. Odpověď byla zastavena; nic se neprovedlo.";
  vi.mocked(sendAiMessage).mockImplementation(async (input) => {
    input.onProgress?.({ content: "Podezřelý výpis", workload: "chat" });
    throw new Error(message);
  });
  await setup();
  fireEvent.change(screen.getByLabelText("Zpráva Máše"), { target: { value: "Vysvětli TLS" } });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  await screen.findByText(message);
  expect(screen.queryByText("Podezřelý výpis")).toBeNull();
  expect(screen.queryByRole("button", { name: "Použít" })).toBeNull();
  expect(apply).not.toHaveBeenCalled();
  expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("Vysvětli TLS");
  vi.mocked(sendAiMessage).mockResolvedValue({ content: "TLS chrání spojení.", completeNoteIds: [], provider: "ollama", model: "fixture" });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  await screen.findByText("TLS chrání spojení.");
  expect(vi.mocked(sendAiMessage).mock.calls[1][0].messages).toHaveLength(1);
});
it("refuses whole-document replacement when the model received partial context", async () => {
  vi.mocked(sendAiMessage).mockResolvedValue({ content: block([{ type: "update_note", noteId: "a", content: "truncated replacement" }]), completeNoteIds: [], provider: "ollama", model: "fixture" });
  await setup(); send();
  await screen.findByText(/Přepis odmítnut/);
  expect(apply).not.toHaveBeenCalled();
  expect(screen.queryByRole("button", { name: "Použít" })).toBeNull();
});

it.each(["Enter", "button"])("sends the current draft with %s even without crypto.randomUUID", async (trigger) => {
  vi.mocked(sendAiMessage).mockResolvedValue({ content: "Odpověď dorazila", completeNoteIds: [], provider: "ollama", model: "fixture" });
  await setup();
  vi.stubGlobal("crypto", { getRandomValues: crypto.getRandomValues.bind(crypto) });
  const input = screen.getByRole("textbox");
  fireEvent.change(input, { target: { value: "Ahoj Mášo" } });
  if (trigger === "Enter") fireEvent.keyDown(input, { key: "Enter" });
  else fireEvent.click(screen.getByRole("button", { name: "Send" }));
  await screen.findByText("Odpověď dorazila");
  expect(sendAiMessage).toHaveBeenCalledTimes(1);
  expect(vi.mocked(sendAiMessage).mock.calls[0][0].messages.at(-1)?.content).toBe("Ahoj Mášo");
  expect((input as HTMLTextAreaElement).value).toBe("");
});

it("keeps Shift+Enter and IME confirmation for editing instead of submitting", async () => {
  await setup();
  const input = screen.getByRole("textbox");
  fireEvent.change(input, { target: { value: "Rozepsaná zpráva" } });
  fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
  fireEvent.keyDown(input, { key: "Enter", isComposing: true });
  expect(sendAiMessage).not.toHaveBeenCalled();
  expect((input as HTMLTextAreaElement).value).toBe("Rozepsaná zpráva");
});

it("shows a submit preparation error and retains the draft for retry", async () => {
  await setup();
  vi.spyOn(crypto, "randomUUID").mockImplementation(() => { throw new Error("ID generation failed"); });
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Důležitý text" } });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  await screen.findByText("ID generation failed");
  expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("Důležitý text");
  expect(sendAiMessage).not.toHaveBeenCalled();
});

it("submits the visible textarea value even when filling it did not dispatch a change event", async () => {
  vi.mocked(sendAiMessage).mockResolvedValue({ content: "Vyplněný text dorazil", completeNoteIds: [], provider: "ollama", model: "fixture" });
  await setup();
  (screen.getByRole("textbox") as HTMLTextAreaElement).value = "Text vložený do formuláře";
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  await screen.findByText("Vyplněný text dorazil");
  expect(vi.mocked(sendAiMessage).mock.calls[0][0].messages.at(-1)?.content).toBe("Text vložený do formuláře");
});

it("does not let an offline status probe silently block an actual chat attempt", async () => {
  vi.mocked(autoDetectLocalProvider).mockResolvedValueOnce(null);
  vi.mocked(checkProviderStatus).mockResolvedValueOnce(null);
  vi.mocked(sendAiMessage).mockRejectedValueOnce(new Error("Model není dostupný"));
  render(<AiPanel notes={[]} activeNote={null} folders={[]} visible onRequestHide={() => {}} onApplyAgentAction={apply} />);
  await screen.findByText("Máša čeká na model.");
  const input = screen.getByRole("textbox");
  fireEvent.change(input, { target: { value: "Zkus spojení" } });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  await screen.findByText("Model není dostupný");
  expect(sendAiMessage).toHaveBeenCalledTimes(1);
  expect((input as HTMLTextAreaElement).value).toBe("Zkus spojení");
});

it("does not block a foreground message while background preloading is pending", async () => {
  saveAiSettings({ provider: "ollama", model: "fixture", baseUrl: "http://localhost:11434", apiKey: "", responseStyle: "fast" });
  let finish!: (result: { state: "ready"; model: string; message: string }) => void;
  const preload = new Promise<{ state: "ready"; model: string; message: string }>((resolve) => { finish = resolve; });
  const ensure = vi.fn(({ warmup }: { warmup?: boolean }) => warmup ? preload : Promise.resolve({ state: "ready" as const, model: "fixture", message: "ready" }));
  window.ethicalDesktop = { ensureLocalModel: ensure } as unknown as EthicalDesktopApi;
  vi.mocked(sendAiMessage).mockResolvedValueOnce({ content: "Ahoj!", provider: "ollama", model: "fixture", completeNoteIds: [] });
  await setup();
  await screen.findByText(/Přednačítám model na pozadí/);
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Ahoj" } });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  await screen.findByText("Ahoj!");
  expect(sendAiMessage).toHaveBeenCalledTimes(1);
  finish({ state: "ready", model: "fixture", message: "ready" });
  await screen.findByText("Model je přednačtený.");
});
