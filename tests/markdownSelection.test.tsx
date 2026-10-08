// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ConnectorPanel } from "../src/components/ConnectorPanel";
import { readMarkdownSelection } from "../src/lib/markdownSelection";
import type { Note } from "../src/types";

vi.mock("../src/lib/notionConnector", () => ({ getNotionStatus: vi.fn(async () => ({ configured: false, connected: false, workspaceName: null })) }));
afterEach(cleanup);

function file(name: string, text: string): File {
  const result = new File([text], name, { type: "text/markdown" });
  Object.defineProperty(result, "text", { value: vi.fn(async () => text) });
  return result;
}

it("imports multiple selected files and allows selecting the same files again", async () => {
  const existing: Note = { id: "existing", title: "Existing", folder: "", content: "keep", createdAt: "old", updatedAt: "old" };
  const save = vi.fn(async () => {});
  render(<ConnectorPanel notes={[existing]} onImportNotes={save} />);
  const input = screen.getByLabelText("Markdown soubory") as HTMLInputElement;
  expect(input.multiple).toBe(true);
  const files = [file("One.md", "# One"), file("Two.MD", "# Two")];
  fireEvent.change(input, { target: { files } });
  await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
  expect(save.mock.calls[0]).toEqual([expect.arrayContaining([expect.objectContaining({ title: "One", content: "# One" }), expect.objectContaining({ title: "Two", content: "# Two" })]), [existing]]);
  await screen.findByText(/Importováno 2 poznámek/);
  expect(input.value).toBe("");
  fireEvent.change(input, { target: { files } });
  await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
});

it("rejects a conflicting or unreadable batch without saving any note", async () => {
  const save = vi.fn(async () => {});
  render(<ConnectorPanel notes={[]} onImportNotes={save} />);
  fireEvent.change(screen.getByLabelText("Markdown soubory"), { target: { files: [file("one.md", "first"), file("ONE.md", "second")] } });
  await screen.findByText(/Kolize cest importu/);
  expect(save).not.toHaveBeenCalled();
  const broken = file("broken.md", "");
  vi.mocked(broken.text).mockRejectedValue(new Error("Cannot read file"));
  fireEvent.change(screen.getByLabelText("Markdown soubory"), { target: { files: [file("good.md", "good"), broken] } });
  await screen.findByText("Cannot read file");
  expect(save).not.toHaveBeenCalled();
});

it("accepts more than the previous 2000-file limit and rejects over 100000 before reading", async () => {
  const files = Array.from({ length: 2001 }, (_, index) => file(`${index}.md`, "# Note"));
  expect(await readMarkdownSelection(files)).toHaveLength(2001);
  const unread = file("note.md", "note");
  await expect(readMarkdownSelection(Array(100001).fill(unread))).rejects.toThrow("100 000");
  expect(unread.text).not.toHaveBeenCalled();
});
