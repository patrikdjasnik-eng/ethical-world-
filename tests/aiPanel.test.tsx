// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import AiPanel from "../src/components/AiPanel";
import { sendAiMessage } from "../src/lib/ai";
import { listAgentAudit } from "../src/lib/storage";
import type { AgentAction, Note } from "../src/types";

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
  Element.prototype.scrollIntoView = vi.fn();
  await new Promise<void>((resolve) => { const request = indexedDB.deleteDatabase("ethical-world"); request.onsuccess = () => resolve(); });
});
afterEach(cleanup);
async function setup() {
  render(<AiPanel notes={[note]} activeNote={note} folders={[{ id: "f", path: "Lab", name: "Lab", parentPath: null, createdAt: "old", updatedAt: "old" }]} visible onRequestHide={() => {}} onApplyAgentAction={apply} />);
  await waitFor(() => expect((screen.getByRole("button", { name: "Send" }) as HTMLButtonElement).disabled).toBe(false));
}
function send() {
  fireEvent.change(screen.getByPlaceholderText("Řekni Máše, co má v Ethical World udělat…"), { target: { value: "udělej poznámku" } });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
}
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
it("AGENT auto-creates only in the explicitly granted folder", async () => {
  vi.mocked(sendAiMessage).mockResolvedValue({ content: block([{ type: "create_note", title: "In", folder: "Lab", content: "safe" }, { type: "create_note", title: "Out", folder: "", content: "pending" }]), completeNoteIds: [], provider: "ollama", model: "fixture" });
  await setup();
  fireEvent.click(screen.getByTitle("AI nastavení"));
  fireEvent.change(screen.getByLabelText("Agent permissions"), { target: { value: "agent" } });
  fireEvent.change(screen.getByLabelText("Agent scope"), { target: { value: "Lab" } });
  send();
  await waitFor(() => expect(apply).toHaveBeenCalledTimes(1));
  expect(apply.mock.calls[0][0]).toMatchObject({ title: "In" });
  await screen.findByRole("button", { name: "Použít" });
});
it("refuses whole-document replacement when the model received partial context", async () => {
  vi.mocked(sendAiMessage).mockResolvedValue({ content: block([{ type: "update_note", noteId: "a", content: "truncated replacement" }]), completeNoteIds: [], provider: "ollama", model: "fixture" });
  await setup(); send();
  await screen.findByText(/Přepis odmítnut/);
  expect(apply).not.toHaveBeenCalled();
  expect(screen.queryByRole("button", { name: "Použít" })).toBeNull();
});
