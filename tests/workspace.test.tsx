// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import App from "../src/App";
import * as storage from "../src/lib/storage";
import type { AgentAction, Note } from "../src/types";

vi.mock("../src/lib/auth", () => ({ initialiseAccount: vi.fn(async () => null) }));
vi.mock("../src/lib/carrot", () => ({ createCarrotCommit: vi.fn(async () => null), verifyCarrotHistory: vi.fn(async () => ({})) }));
vi.mock("../src/components/VaultSidebar", () => ({
  VaultSidebar: ({ notes, onSelectNote }: { notes: Note[]; onSelectNote: (id: string) => void }) => <nav>{notes.map((note) => <button key={note.id} onClick={() => onSelectNote(note.id)}>select {note.title}</button>)}</nav>
}));
vi.mock("../src/components/AiPanel", () => ({
  default: ({ onApplyAgentAction }: { onApplyAgentAction: (action: AgentAction) => Promise<string> }) => <button onClick={() => void (async () => {
    await onApplyAgentAction({ type: "create_folder", name: "Batch folder" });
    await onApplyAgentAction({ type: "create_note", title: "Batch note", content: "created", folder: "Batch folder" });
  })()}>test batch</button>
}));

const first: Note = { id: "first", title: "First", content: "old", folder: "", createdAt: "2026-10-06T00:00:00Z", updatedAt: "2026-10-06T00:00:00Z" };
const second: Note = { ...first, id: "second", title: "Second" };

beforeEach(async () => {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase("ethical-world");
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  await storage.saveNotes([first, second]);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("workspace persistence and dependent actions", () => {
  it("persists an edit even when selection changes immediately", async () => {
    const view = render(<StrictMode><App /></StrictMode>);
    const editor = await screen.findByRole("textbox", { name: "Obsah poznámky" });
    fireEvent.change(editor, { target: { value: "latest before fast switch" } });
    fireEvent.click(await screen.findByRole("button", { name: "select Second" }));
    await waitFor(async () => expect((await storage.listNotes()).find((note) => note.id === "first")?.content).toBe("latest before fast switch"));
    view.unmount();
    render(<App />);
    await screen.findByRole("button", { name: "select First" });
    fireEvent.click(screen.getByRole("button", { name: "select First" }));
    expect((await screen.findByRole("textbox", { name: "Obsah poznámky" }) as HTMLTextAreaElement).value).toBe("latest before fast switch");
  });

  it("reports a failed write instead of claiming it was saved", async () => {
    const save = vi.spyOn(storage, "saveNote").mockRejectedValueOnce(new Error("quota exhausted"));
    render(<App />);
    const editor = await screen.findByRole("textbox", { name: "Obsah poznámky" });
    fireEvent.change(editor, { target: { value: "unsaved" } });
    await screen.findByText("chyba uložení");
    expect((await storage.listNotes()).find((note) => note.id === "first")?.content).toBe("old");
    expect(save).toHaveBeenCalled();
  });

  it("dependent batch actions see the newly created folder", async () => {
    render(<App />);
    await screen.findByRole("textbox", { name: "Obsah poznámky" });
    await waitFor(() => expect(screen.getAllByRole("button", { name: "Máša" })[0]).toBeTruthy());
    fireEvent.click(screen.getAllByRole("button", { name: "Máša" })[0]);
    fireEvent.click(await screen.findByRole("button", { name: "test batch" }));
    await waitFor(async () => expect((await storage.listNotes()).some((note) => note.title === "Batch note" && note.folder === "Batch folder")).toBe(true));
  });
});
