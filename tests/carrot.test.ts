import { describe, expect, it } from "vitest";
import {
  carrotCommitHash,
  carrotSigningPayload,
  carrotSnapshotHash,
  verifyCarrotCommitIntegrity,
  verifyCarrotHistory
} from "../src/lib/carrot";
import type { CarrotCommit } from "../src/types";

describe("Carrot integrity", () => {
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

  it("recomputes snapshot and commit hashes before trusting a commit", async () => {
    const snapshotHash = await carrotSnapshotHash({
      title: "Nmap",
      folder: "Cyber",
      content: "# Nmap\n"
    });

    const unsigned = {
      id: "commit-2",
      noteId: "note-1",
      parentId: null,
      title: "Nmap",
      folder: "Cyber",
      content: "# Nmap\n",
      snapshotHash,
      parentCommitHash: null,
      message: "Autosave Markdown",
      authorUserId: "user-1",
      authorDisplayName: "Owner",
      createdAt: "2026-10-04T00:00:00.000Z"
    };

    const commitHash = await carrotCommitHash(unsigned);
    const commit: CarrotCommit = {
      ...unsigned,
      commitHash,
      signatureAlgorithm: "unsigned-browser",
      signature: null,
      publicKey: null,
      keyId: null
    };

    await expect(verifyCarrotCommitIntegrity(commit)).resolves.toBe(true);
    await expect(verifyCarrotCommitIntegrity({ ...commit, content: "# tampered\n" })).resolves.toBe(false);
    await expect(verifyCarrotCommitIntegrity({ ...commit, commitHash: "tampered" })).resolves.toBe(false);
  });

  it("propagates a broken parent through the loaded Carrot chain", async () => {
    const rootSnapshotHash = await carrotSnapshotHash({
      title: "Root",
      folder: "Cyber",
      content: "# Root\n"
    });

    const rootUnsigned = {
      id: "root",
      noteId: "note-1",
      parentId: null,
      title: "Root",
      folder: "Cyber",
      content: "# Root\n",
      snapshotHash: rootSnapshotHash,
      parentCommitHash: null,
      message: "Root",
      authorUserId: "user-1",
      authorDisplayName: "Owner",
      createdAt: "2026-10-04T00:00:00.000Z"
    };
    const rootCommitHash = await carrotCommitHash(rootUnsigned);

    const root: CarrotCommit = {
      ...rootUnsigned,
      commitHash: rootCommitHash,
      signatureAlgorithm: "unsigned-browser",
      signature: null,
      publicKey: null,
      keyId: null
    };

    const childSnapshotHash = await carrotSnapshotHash({
      title: "Child",
      folder: "Cyber",
      content: "# Child\n"
    });
    const childUnsigned = {
      id: "child",
      noteId: "note-1",
      parentId: root.id,
      title: "Child",
      folder: "Cyber",
      content: "# Child\n",
      snapshotHash: childSnapshotHash,
      parentCommitHash: root.commitHash,
      message: "Child",
      authorUserId: "user-1",
      authorDisplayName: "Owner",
      createdAt: "2026-10-04T00:01:00.000Z"
    };

    const child: CarrotCommit = {
      ...childUnsigned,
      commitHash: await carrotCommitHash(childUnsigned),
      signatureAlgorithm: "unsigned-browser",
      signature: null,
      publicKey: null,
      keyId: null
    };

    const valid = await verifyCarrotHistory([child, root]);
    expect(valid.root).toBeNull();
    expect(valid.child).toBeNull();

    const tamperedRoot = { ...root, content: "# tampered\n" };
    const broken = await verifyCarrotHistory([child, tamperedRoot]);
    expect(broken.root).toBe(false);
    expect(broken.child).toBe(false);
  });
});
