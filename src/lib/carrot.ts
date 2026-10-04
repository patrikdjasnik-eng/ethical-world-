import { listCarrotCommits, saveCarrotCommit } from "./storage";
import type { CarrotCommit, Note, UserProfile } from "../types";

const encoder = new TextEncoder();

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return bytesToHex(new Uint8Array(digest));
}

type UnsignedCarrotCommit = Omit<
  CarrotCommit,
  "signature" | "publicKey" | "keyId" | "signatureAlgorithm" | "commitHash"
>;

export function carrotSigningPayload(commit: UnsignedCarrotCommit): string {
  return JSON.stringify({
    version: 1,
    id: commit.id,
    noteId: commit.noteId,
    parentId: commit.parentId,
    title: commit.title,
    folder: commit.folder,
    snapshotHash: commit.snapshotHash,
    parentCommitHash: commit.parentCommitHash,
    message: commit.message,
    authorUserId: commit.authorUserId,
    authorDisplayName: commit.authorDisplayName,
    createdAt: commit.createdAt
  });
}

export async function carrotSnapshotHash(note: Pick<Note, "title" | "folder" | "content">): Promise<string> {
  return sha256(JSON.stringify({
    title: note.title,
    folder: note.folder,
    content: note.content
  }));
}

export async function carrotCommitHash(commit: UnsignedCarrotCommit): Promise<string> {
  return sha256(carrotSigningPayload(commit));
}

function unsignedFromCommit(commit: CarrotCommit): UnsignedCarrotCommit {
  return {
    id: commit.id,
    noteId: commit.noteId,
    parentId: commit.parentId,
    title: commit.title,
    folder: commit.folder,
    content: commit.content,
    snapshotHash: commit.snapshotHash,
    parentCommitHash: commit.parentCommitHash,
    message: commit.message,
    authorUserId: commit.authorUserId,
    authorDisplayName: commit.authorDisplayName,
    createdAt: commit.createdAt
  };
}

export async function verifyCarrotCommitIntegrity(commit: CarrotCommit): Promise<boolean> {
  const expectedSnapshotHash = await carrotSnapshotHash(commit);
  if (expectedSnapshotHash !== commit.snapshotHash) return false;

  const expectedCommitHash = await carrotCommitHash(unsignedFromCommit(commit));
  return expectedCommitHash === commit.commitHash;
}

export async function createCarrotCommit(
  note: Note,
  user: UserProfile | null,
  message = "Markdown snapshot"
): Promise<CarrotCommit | null> {
  const history = await listCarrotCommits(note.id);
  const parent = history[0] ?? null;
  const nextHash = await carrotSnapshotHash(note);

  if (parent?.snapshotHash === nextHash) return null;

  const unsigned: UnsignedCarrotCommit = {
    id: crypto.randomUUID(),
    noteId: note.id,
    parentId: parent?.id ?? null,
    title: note.title,
    folder: note.folder,
    content: note.content,
    snapshotHash: nextHash,
    parentCommitHash: parent?.commitHash ?? null,
    message: message.trim().slice(0, 240) || "Markdown snapshot",
    authorUserId: user?.id ?? "local-anonymous",
    authorDisplayName: user?.displayName ?? "Local user",
    createdAt: new Date().toISOString()
  };

  const payload = carrotSigningPayload(unsigned);
  const commitHash = await sha256(payload);

  let signature: string | null = null;
  let publicKey: string | null = null;
  let keyId: string | null = null;
  let signatureAlgorithm: CarrotCommit["signatureAlgorithm"] = "unsigned-browser";

  if (window.ethicalDesktop?.carrotSign) {
    const signed = await window.ethicalDesktop.carrotSign(payload);
    signature = signed.signature;
    publicKey = signed.publicKey;
    keyId = signed.keyId;
    signatureAlgorithm = "Ed25519";
  }

  const commit: CarrotCommit = {
    ...unsigned,
    commitHash,
    signature,
    publicKey,
    keyId,
    signatureAlgorithm
  };

  await saveCarrotCommit(commit);
  return commit;
}

export async function verifyCarrotCommit(commit: CarrotCommit): Promise<boolean | null> {
  if (!await verifyCarrotCommitIntegrity(commit)) return false;

  if (
    commit.signatureAlgorithm !== "Ed25519" ||
    !commit.signature ||
    !commit.publicKey ||
    typeof window === "undefined" ||
    !window.ethicalDesktop?.carrotVerify
  ) {
    return null;
  }

  return window.ethicalDesktop.carrotVerify(
    carrotSigningPayload(unsignedFromCommit(commit)),
    commit.signature,
    commit.publicKey
  );
}

export async function verifyCarrotHistory(
  commits: CarrotCommit[]
): Promise<Record<string, boolean | null>> {
  const byId = new Map(commits.map((commit) => [commit.id, commit]));
  const ownVerification = new Map<string, boolean | null>();

  await Promise.all(commits.map(async (commit) => {
    ownVerification.set(commit.id, await verifyCarrotCommit(commit));
  }));

  const chainCache = new Map<string, boolean>();

  const chainIsValid = (commit: CarrotCommit, visiting = new Set<string>()): boolean => {
    const cached = chainCache.get(commit.id);
    if (cached !== undefined) return cached;

    if (visiting.has(commit.id) || ownVerification.get(commit.id) === false) {
      chainCache.set(commit.id, false);
      return false;
    }

    if (commit.parentId === null) {
      const validRoot = commit.parentCommitHash === null;
      chainCache.set(commit.id, validRoot);
      return validRoot;
    }

    const parent = byId.get(commit.parentId);
    if (
      !parent ||
      parent.noteId !== commit.noteId ||
      parent.commitHash !== commit.parentCommitHash ||
      parent.createdAt > commit.createdAt
    ) {
      chainCache.set(commit.id, false);
      return false;
    }

    const nextVisiting = new Set(visiting);
    nextVisiting.add(commit.id);
    const valid = chainIsValid(parent, nextVisiting);
    chainCache.set(commit.id, valid);
    return valid;
  };

  return Object.fromEntries(
    commits.map((commit) => [
      commit.id,
      chainIsValid(commit) ? ownVerification.get(commit.id) ?? null : false
    ])
  );
}
