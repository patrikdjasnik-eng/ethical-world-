import { listCarrotCommits, saveCarrotCommit } from "./storage";
import { carrotHead, orderCarrotHistory } from "./carrotOrder";
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

async function writeCarrotCommit(
  note: Note,
  user: UserProfile | null,
  message = "Markdown snapshot"
): Promise<CarrotCommit | null> {
  const history = await listCarrotCommits(note.id);
  const parent = history[0] ?? null;
  if (parent?.signature && parent.publicKey && typeof window !== "undefined" && window.ethicalDesktop?.carrotConfirmSaved) {
    await window.ethicalDesktop.carrotConfirmSaved(carrotSigningPayload(unsignedFromCommit(parent)), parent.signature, parent.publicKey);
  }
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
  if (signature && publicKey && window.ethicalDesktop?.carrotConfirmSaved) {
    await window.ethicalDesktop.carrotConfirmSaved(payload, signature, publicKey);
  }
  return commit;
}

const commitQueues = new Map<string, Promise<CarrotCommit | null>>();

export function createCarrotCommit(note: Note, user: UserProfile | null, message = "Markdown snapshot"): Promise<CarrotCommit | null> {
  const previous = commitQueues.get(note.id) ?? Promise.resolve(null);
  const snapshot = { ...note };
  const task = previous.catch(() => null).then(() => writeCarrotCommit(snapshot, user, message));
  commitQueues.set(note.id, task);
  void task.finally(() => {
    if (commitQueues.get(note.id) === task) commitQueues.delete(note.id);
  }).catch(() => undefined);
  return task;
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
  commits: CarrotCommit[], noteId: string | undefined = commits[0]?.noteId
): Promise<Record<string, boolean | null>> {
  let head: CarrotCommit | null;
  try { head = carrotHead(commits); } catch {
    return { $history: false, ...Object.fromEntries(commits.map((commit) => [commit.id, false])) };
  }
  const ownVerification = new Map<string, boolean | null>();
  for (let offset = 0; offset < commits.length; offset += 16) {
    await Promise.all(commits.slice(offset, offset + 16).map(async (commit) => {
      ownVerification.set(commit.id, await verifyCarrotCommit(commit));
    }));
  }
  const chainCache = new Map<string, boolean>();
  for (const commit of orderCarrotHistory(commits).reverse()) {
    const validParent = commit.parentId === null
      ? commit.parentCommitHash === null
      : chainCache.get(commit.parentId) === true;
    chainCache.set(commit.id, validParent && ownVerification.get(commit.id) !== false);
  }
  if (typeof window !== "undefined" && window.ethicalDesktop?.carrotVerifyHead && noteId) {
    const trustedHead = await window.ethicalDesktop.carrotVerifyHead(noteId, head?.commitHash ?? "");
    if (trustedHead === false) return { $history: false, ...Object.fromEntries(commits.map((commit) => [commit.id, false])) };
  }

  return Object.fromEntries(
    commits.map((commit) => [
      commit.id,
      chainCache.get(commit.id) ? ownVerification.get(commit.id) ?? null : false
    ])
  );
}
