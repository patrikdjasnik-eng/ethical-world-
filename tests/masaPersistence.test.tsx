// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import App from "../src/App";
import { sendAiMessage } from "../src/lib/ai";
import * as storage from "../src/lib/storage";
import type { Note } from "../src/types";

vi.mock("../src/lib/auth", () => ({ initialiseAccount: vi.fn(async () => null) }));
vi.mock("../src/lib/carrot", () => ({ createCarrotCommit: vi.fn(async () => null), verifyCarrotHistory: vi.fn(async () => ({})) }));
vi.mock("../src/lib/ai", () => ({
  checkGatewayHealth: vi.fn(async () => true),
  autoDetectLocalProvider: vi.fn(async () => ({ online: true, provider: "ollama", model: "fixture", models: ["fixture"], baseUrl: "http://localhost:11434" })),
  checkProviderStatus: vi.fn(async () => ({ online: true, model: "fixture", models: ["fixture"] })),
  sendAiMessage: vi.fn()
}));
vi.mock("../src/components/VaultSidebar", () => ({
  VaultSidebar: ({ notes, onSelectNote }: { notes: Note[]; onSelectNote: (id: string) => void }) => <nav>{notes.map((note) => <button key={note.id} onClick={() => onSelectNote(note.id)}>select {note.title}</button>)}</nav>
}));
const original: Note = { id: "source", title: "Original", folder: "", content: "preserve original", createdAt: "old", updatedAt: "old" };
beforeEach(async () => {
  vi.clearAllMocks();
  localStorage.clear();
  Element.prototype.scrollIntoView = vi.fn();
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase("ethical-world");
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  await storage.saveNote(original);
});
afterEach(() => { cleanup(); delete window.ethicalDesktop; vi.restoreAllMocks(); });
async function openMasa() {
  await screen.findByRole("textbox", { name: "Obsah poznámky" });
  fireEvent.click(screen.getAllByRole("button", { name: "Máša" })[0]);
  await screen.findByText(/Online · fixture/);
}
function send(text: string) {
  fireEvent.change(screen.getByRole("textbox", { name: "Zpráva Máše" }), { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
}

it("opens the chat from the companion and retains its hidden preference across reopening", async () => {
  const view = render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: /Otevřít Mášu/ }));
  await screen.findByText(/Online · fixture/);
  expect(screen.queryByRole("button", { name: /Otevřít Mášu/ })).toBeNull();
  fireEvent.click(screen.getByTitle("Minimalizovat Mášu do lišty"));
  fireEvent.click(await screen.findByRole("button", { name: "Skrýt postavičku Máši" }));
  expect(screen.queryByRole("button", { name: /Otevřít Mášu/ })).toBeNull();
  view.unmount();
  render(<App />);
  await screen.findByRole("textbox", { name: "Obsah poznámky" });
  expect(screen.queryByRole("button", { name: /Otevřít Mášu/ })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Pet" }));
  expect(screen.getByRole("button", { name: /Otevřít Mášu/ })).toBeTruthy();
});

it("reflects a live request and its failure in the minimized companion without losing the draft", async () => {
  let rejectRequest: (error: Error) => void = () => {};
  let progress: ((content: string) => void) | undefined;
  vi.mocked(sendAiMessage).mockImplementation((input) => {
    progress = (content) => input.onProgress?.({ content, workload: "chat" });
    return new Promise<Awaited<ReturnType<typeof sendAiMessage>>>((_resolve, reject) => { rejectRequest = reject; });
  });
  render(<App />);
  await openMasa();
  send("Vysvětli threat hunting");
  await waitFor(() => expect(sendAiMessage).toHaveBeenCalled());
  fireEvent.click(screen.getByTitle("Minimalizovat Mášu do lišty"));
  await screen.findByRole("button", { name: "Otevřít Mášu · Přemýšlím…" });
  act(() => { progress?.("První část odpovědi"); });
  await screen.findByRole("button", { name: "Otevřít Mášu · Píšu odpověď…" });
  await act(async () => { rejectRequest(new Error("Connection lost")); });
  fireEvent.click(await screen.findByRole("button", { name: "Otevřít Mášu · Potřebuju tvoji pozornost" }));
  expect((screen.getByRole("textbox", { name: "Zpráva Máše" }) as HTMLTextAreaElement).value).toBe("Vysvětli threat hunting");
  expect(screen.getByRole("alert").textContent).toContain("Connection lost");
});

it("creates and updates actual Markdown notes after consent and retains them after reopening", async () => {
  const markdown = "# Malware\n\nŠkodlivý software.\n\n```python\nprint('demo')\n```\n\nLiteral </content> stays.";
  vi.mocked(sendAiMessage).mockResolvedValueOnce({ content: "proposal", provider: "ollama", model: "fixture", completeNoteIds: [], actions: [{ type: "create_note", title: "Malware", folder: "", content: markdown, knowledgeNote: true }] });
  const view = render(<App />);
  await openMasa();
  send("Vytvoř poznámku o malware");
  await screen.findByRole("button", { name: "Použít" });
  expect((await storage.listNotes()).map((note) => note.title)).not.toContain("Malware");
  expect(screen.queryByText(/Vytvořena poznámka/)).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Použít" }));
  await screen.findByText('✓ Vytvořena poznámka „Malware“.');
  const created = (await storage.listNotes()).find((note) => note.title === "Malware")!;
  expect(created.content).toContain(markdown);
  vi.mocked(sendAiMessage).mockResolvedValueOnce({ content: "proposal", provider: "ollama", model: "fixture", completeNoteIds: [created.id], actions: [{ type: "update_note", noteId: created.id, title: created.title, folder: "", content: created.content + "\n\n## Detekce\nKontrola logů." }] });
  send("Doplň poznámku o detekci");
  fireEvent.click(await screen.findByRole("button", { name: "Použít" }));
  await screen.findByText('✓ Upravena poznámka „Malware“.');
  view.unmount();
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: "select Malware" }));
  const editor = await screen.findByRole("textbox", { name: "Obsah poznámky" });
  await waitFor(() => expect((editor as HTMLTextAreaElement).value).toContain("## Detekce"));
  expect((await storage.listNotes()).find((note) => note.id === original.id)?.content).toBe(original.content);
});

it("keeps a failed creation pending and never claims success", async () => {
  vi.mocked(sendAiMessage).mockResolvedValueOnce({ content: "proposal", provider: "ollama", model: "fixture", completeNoteIds: [], actions: [{ type: "create_note", title: "Unsaved", folder: "", content: "# Unsaved" }] });
  render(<App />);
  await openMasa();
  send("Vytvoř poznámku");
  const button = await screen.findByRole("button", { name: "Použít" });
  vi.spyOn(storage, "saveNote").mockRejectedValueOnce(new Error("quota exhausted"));
  fireEvent.click(button);
  await screen.findByText("quota exhausted");
  expect((await storage.listNotes()).some((note) => note.title === "Unsaved")).toBe(false);
  expect(screen.queryByText(/✓ Vytvořena/)).toBeNull();
  expect(screen.getByRole("button", { name: "Použít" })).toBeTruthy();
});

it("starts background model preparation after account startup without opening the AI panel", async () => {
  const backend = vi.fn(async () => ({ state: "ready", source: "bundled", message: "ready" }));
  const model = vi.fn(async () => ({ state: "ready", model: "masa-cyber", message: "ready" }));
  window.ethicalDesktop = { ensureBackendRuntime: backend, ensureLocalModel: model } as unknown as NonNullable<Window["ethicalDesktop"]>;
  render(<App />);
  await waitFor(() => expect(model).toHaveBeenCalledWith(expect.objectContaining({ warmup: true })));
  expect(backend).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("textbox", { name: "Zpráva Máše" })).toBeNull();
  delete window.ethicalDesktop;
});

it("applies a proposed folder before its dependent note using the real workspace writer", async () => {
  vi.mocked(sendAiMessage).mockResolvedValueOnce({ content: "proposal", provider: "ollama", model: "fixture", completeNoteIds: [], actions: [
    { type: "create_folder", name: "Cybersecurity", parentPath: null },
    { type: "create_note", title: "Threat hunting", folder: "Cybersecurity", content: "# Threat hunting\n\nAnalýza událostí." }
  ] });
  render(<App />);
  await openMasa();
  send("Vytvoř poznámku o threat huntingu ve složce Cybersecurity");
  fireEvent.click(await screen.findByRole("button", { name: "Použít vše" }));
  await waitFor(async () => expect((await storage.listNotes()).find((note) => note.title === "Threat hunting")?.folder).toBe("Cybersecurity"));
  expect((await storage.listFolders()).some((folder) => folder.path === "Cybersecurity")).toBe(true);
});
