// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ResearchPanel } from "../src/components/ResearchPanel";
import type { EthicalDesktopApi } from "../src/types/desktop";
import type { ResearchJob } from "../src/types/research";

afterEach(() => { cleanup(); delete window.ethicalDesktop; });
it("requires an explicit import and retains provenance and partial-content metadata", async () => {
  const job: ResearchJob = { id: "fixture", status: "succeeded", urls: ["https://example.org"], createdAt: "today", completed: 1, failed: 0, resultCount: 1, logs: [], results: [{ title: "Article", url: "https://example.org", text: "excerpt", incomplete: true, fetchedAt: "today" }] };
  const onImportNotes = vi.fn(async () => {});
  Object.defineProperty(window, "ethicalDesktop", { configurable: true, value: { researchStart: vi.fn(), researchList: async () => [job], researchRead: async () => job } as unknown as EthicalDesktopApi });
  render(<ResearchPanel notes={[]} onImportNotes={onImportNotes} />);
  fireEvent.click(await screen.findByRole("button", { name: "Výsledky (1)" }));
  const button = await screen.findByRole("button", { name: "Importovat výsledky do vaultu" });
  expect(onImportNotes).not.toHaveBeenCalled();
  fireEvent.click(button);
  await waitFor(() => expect(onImportNotes).toHaveBeenCalledOnce());
  const note = onImportNotes.mock.calls[0] as unknown as [Array<{ source: { incomplete: boolean; provider: string }; content: string }>];
  expect(note[0][0].source.incomplete).toBe(true);
  expect(note[0][0].source.provider).toBe("web-research");
  expect(note[0][0].content).toContain("https://example.org");
  expect(screen.getByRole("link", { name: "Crawlee by Apify" }).getAttribute("href")).toBe("https://github.com/apify/crawlee");
});
