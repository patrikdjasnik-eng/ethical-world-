// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { createRequire } from "node:module";
import { afterEach, expect, it, vi } from "vitest";
import { createCarrotCommit, verifyCarrotHistory } from "../src/lib/carrot";
import type { Note } from "../src/types";

const require = createRequire(import.meta.url);
const { createSigner } = require("../electron/secure-store.cjs");

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); delete window.ethicalDesktop; });

it("keeps the signed chain ordered when timestamps tie or the clock moves backwards", async () => {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase("ethical-world");
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  const saved = new Map<string, string>();
  const signer = createSigner({ load: async (key: string) => saved.get(key) ?? null, save: async (key: string, value: string) => { saved.set(key, value); } });
  Object.defineProperty(window, "ethicalDesktop", { configurable: true, value: { carrotSign: signer.sign, carrotConfirmSaved: signer.confirm, carrotVerify: signer.verify, carrotVerifyHead: signer.verifyHead } });
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-07T18:00:00Z"));
  vi.spyOn(crypto, "randomUUID").mockReturnValueOnce("10000000-0000-4000-8000-000000000000").mockReturnValueOnce("20000000-0000-4000-8000-000000000000").mockReturnValueOnce("30000000-0000-4000-8000-000000000000");
  const note: Note = { id: "same-time", title: "Clock", folder: "", content: "one", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  await createCarrotCommit(note, null);
  await createCarrotCommit({ ...note, content: "two" }, null);
  vi.setSystemTime(new Date("2026-10-06T18:00:00Z"));
  const third = await createCarrotCommit({ ...note, content: "three" }, null);
  expect(third?.parentId).toBe("20000000-0000-4000-8000-000000000000");
  const { listCarrotCommits } = await import("../src/lib/storage");
  const history = await listCarrotCommits(note.id);
  expect(history[0].id).toBe(third?.id);
  expect(Object.values(await verifyCarrotHistory(history, note.id))).toEqual([true, true, true]);
});

it("reports an empty local history when the trusted checkpoint still exists", async () => {
  const verifyHead = vi.fn(async () => false);
  Object.defineProperty(window, "ethicalDesktop", { configurable: true, value: { carrotVerifyHead: verifyHead } });
  expect(await verifyCarrotHistory([], "lost-note")).toEqual({ $history: false });
  expect(verifyHead).toHaveBeenCalledWith("lost-note", "");
});
