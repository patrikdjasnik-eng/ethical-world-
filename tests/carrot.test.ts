import { describe, expect, it } from "vitest";
import { carrotSigningPayload } from "../src/lib/carrot";

describe("Carrot signing payload", () => {
  it("binds the snapshot and previous commit hash into the signed payload", () => {
    const payload = carrotSigningPayload({
      id: "commit-2",
      noteId: "note-1",
      parentId: "commit-1",
      title: "Nmap",
      folder: "Cyber",
      content: "# Nmap\n",
      snapshotHash: "snapshot-hash",
      parentCommitHash: "parent-commit-hash",
      message: "Autosave Markdown",
      authorUserId: "user-1",
      authorDisplayName: "Owner",
      createdAt: "2026-10-04T00:00:00.000Z"
    });

    expect(payload).toContain('"snapshotHash":"snapshot-hash"');
    expect(payload).toContain('"parentCommitHash":"parent-commit-hash"');
    expect(payload).toContain('"authorUserId":"user-1"');
    expect(payload).not.toContain("# Nmap");
  });
});
