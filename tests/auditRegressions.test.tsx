// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import App from "../src/App";
import * as storage from "../src/lib/storage";
import { markdownFilesToNotes } from "../src/lib/markdownConnector";
import { gatewayFetch } from "../src/lib/gateway";
import { getNotionStatus } from "../src/lib/notionConnector";
import { sendAiMessage } from "../src/lib/ai";
import type { Note } from "../src/types";

vi.mock("../src/lib/auth", () => ({ initialiseAccount: vi.fn(async () => null) }));
vi.mock("../src/lib/carrot", () => ({ createCarrotCommit: vi.fn(async () => null), verifyCarrotHistory: vi.fn(async () => ({})) }));
vi.mock("../src/lib/notionConnector", () => ({
  getNotionStatus: vi.fn(async () => ({ configured: false, connected: false })),
  listNotionPages: vi.fn(async () => [{ id: "page", title: "First" }]),
  readNotionMarkdown: vi.fn(async () => ({ pageId: "page", title: "First", markdown: "partial remote excerpt", truncated: true }))
}));
vi.mock("../src/components/VaultSidebar", () => ({
  VaultSidebar: ({ notes, onSelectNote }: { notes: Note[]; onSelectNote: (id: string) => void }) => <nav>{notes.map((note) => <button key={note.id} onClick={() => onSelectNote(note.id)}>select {note.title}</button>)}</nav>
}));

const first: Note = { id: "first", title: "First", content: "baseline", folder: "", createdAt: "2026-10-06T00:00:00Z", updatedAt: "2026-10-06T00:00:00Z", source: { provider: "local-markdown", connectionId: "local", relativePath: "First.md", baselineContent: "baseline" } };

beforeEach(async () => {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase("ethical-world");
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  await storage.saveNotes([first]);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); delete window.ethicalDesktop; });

it("preserves a saved edit when an import request returns late", async () => {
  let finishRead!: (result: { files: { relativePath: string; content: string }[]; truncated: boolean }) => void;
  const pending = new Promise<{ files: { relativePath: string; content: string }[]; truncated: boolean }>((resolve) => { finishRead = resolve; });
  const read = vi.fn(() => pending);
  Object.defineProperty(window, "ethicalDesktop", { configurable: true, value: {
    githubStatus: vi.fn(async () => ({ configured: false, connected: false })),
    selectMarkdownFolder: vi.fn(async () => ({ id: "local", label: "fixture" })),
    readMarkdownFiles: read
  } });
  render(<App />);
  await screen.findByRole("textbox", { name: "Obsah poznámky" });
  fireEvent.click(screen.getByRole("button", { name: "Connectors" }));
  fireEvent.click(await screen.findByRole("button", { name: "Vybrat složku" }));
  await screen.findByRole("button", { name: "Změnit složku" });
  fireEvent.click(screen.getAllByRole("button", { name: "Import MD" })[0]);
  await waitFor(() => expect(read).toHaveBeenCalledOnce());
  fireEvent.click(screen.getByRole("button", { name: "Poznámky" }));
  const editor = await screen.findByRole("textbox", { name: "Obsah poznámky" });
  fireEvent.change(editor, { target: { value: "local edit while importing" } });
  await waitFor(async () => expect((await storage.listNotes())[0].content).toBe("local edit while importing"));
  await act(async () => { finishRead({ files: [{ relativePath: "First.md", content: "remote version" }], truncated: false }); });
  await waitFor(async () => expect((await storage.listNotes())[0].content).toBe("local edit while importing"));
  expect(await screen.findByRole("textbox", { name: "Obsah poznámky" })).toHaveProperty("value", "local edit while importing");
});

it("accepts a remote change after the exact exported baseline is recorded", () => {
  const exported = { ...first, content: "exported content", source: { ...first.source!, baselineContent: "exported content" } };
  expect(markdownFilesToNotes([{ relativePath: "First.md", content: "new remote edit" }], "local", [exported])[0].content).toBe("new remote edit");
});

it("refuses ambiguous local paths before importing either file", () => {
  const files = [{ relativePath: "A.md", content: "upper" }, { relativePath: "a.md", content: "lower" }];
  expect(() => markdownFilesToNotes(files, "local", [])).toThrow(/Kolize cest/);
});

it("settles cancellation immediately and forwards it to pending desktop IPC", async () => {
  const cancel = vi.fn(async () => undefined);
  Object.defineProperty(window, "ethicalDesktop", { configurable: true, value: { gatewayRequest: () => new Promise(() => {}), cancelGatewayRequest: cancel } });
  const controller = new AbortController();
  const request = gatewayFetch("/api/chat", { method: "POST", body: "{}", signal: controller.signal });
  const rejected = expect(request).rejects.toMatchObject({ name: "AbortError" });
  controller.abort();
  await rejected;
  expect(cancel).toHaveBeenCalledOnce();
});

it("rejects a truncated Notion replacement and marks a new partial note incomplete for AI", async () => {
  const notionNote: Note = { ...first, content: "complete local document", source: { provider: "notion", connectionId: "notion:page", relativePath: "First.md", baselineContent: "complete local document" } };
  await storage.saveNote(notionNote);
  vi.mocked(getNotionStatus).mockResolvedValue({ configured: true, connected: true, workspaceName: "Fixture", workspaceId: "fixture" });
  render(<App />);
  await screen.findByRole("textbox", { name: "Obsah poznámky" });
  fireEvent.click(screen.getByRole("button", { name: "Connectors" }));
  const importButton = await screen.findByRole("button", { name: "Import page" });
  await waitFor(() => expect((importButton as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(importButton);
  await screen.findByText(/Neúplný import nesmí/);
  expect((await storage.listNotes())[0].content).toBe("complete local document");
  const [partial] = markdownFilesToNotes([{ relativePath: "Partial.md", content: "excerpt", incomplete: true }], "notion:new", [], "notion");
  let captured: { vaultContext: { complete: boolean }[] } | undefined;
  Object.defineProperty(window, "ethicalDesktop", { configurable: true, value: { gatewayRequest: async (request: { body: string }) => {
    captured = JSON.parse(request.body);
    return { status: 200, body: JSON.stringify({ content: "fixture", completeNoteIds: [], provider: "openai-compatible", model: "fixture" }) };
  } } });
  await sendAiMessage({ settings: { provider: "openai-compatible", model: "fixture", baseUrl: "http://localhost:8080/v1", apiKey: "" }, messages: [{ id: "query", role: "user", content: "Vysvětli poznámku" }], notes: [partial], folders: [], activeNote: partial, permissionMode: "assist" });
  expect(captured?.vaultContext[0].complete).toBe(false);
});

it("records the exported snapshot as baseline while preserving a newer local edit", async () => {
  vi.mocked(getNotionStatus).mockResolvedValue({ configured: false, connected: false, workspaceName: null, workspaceId: null });
  let finish!: (result: { written: number; paths: string[] }) => void;
  const pending = new Promise<{ written: number; paths: string[] }>((resolve) => { finish = resolve; });
  const write = vi.fn(() => pending);
  Object.defineProperty(window, "ethicalDesktop", { configurable: true, value: {
    githubStatus: vi.fn(async () => ({ configured: false, connected: false })),
    selectMarkdownFolder: vi.fn(async () => ({ id: "local", label: "fixture" })),
    writeMarkdownFiles: write
  } });
  vi.spyOn(window, "confirm").mockReturnValue(true);
  render(<App />);
  const editor = await screen.findByRole("textbox", { name: "Obsah poznámky" });
  fireEvent.change(editor, { target: { value: "exported snapshot" } });
  await waitFor(async () => expect((await storage.listNotes())[0].content).toBe("exported snapshot"));
  fireEvent.click(screen.getByRole("button", { name: "Connectors" }));
  fireEvent.click(await screen.findByRole("button", { name: "Vybrat složku" }));
  await screen.findByRole("button", { name: "Změnit složku" });
  fireEvent.click(screen.getByRole("button", { name: "Export poznámek" }));
  await waitFor(() => expect(write).toHaveBeenCalledOnce());
  fireEvent.click(screen.getByRole("button", { name: "Poznámky" }));
  fireEvent.change(await screen.findByRole("textbox", { name: "Obsah poznámky" }), { target: { value: "newer local edit" } });
  await act(async () => { finish({ written: 1, paths: ["First.md"] }); });
  await waitFor(async () => {
    const [saved] = await storage.listNotes();
    expect(saved.content).toBe("newer local edit");
    expect(saved.source?.baselineContent).toBe("exported snapshot");
  });
});
