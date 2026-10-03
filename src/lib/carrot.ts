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

export function carrotSigningPayload(commit: Omit<CarrotCommit, "signature" | "publicKey" | "keyId" | "signatureAlgorithm">): string {
  return JSON.stringify({
    version: 1,
    id: commit.id,
    noteId: commit.noteId,
    parentId: commit.parentId,
    title: commit.title,
    folder: commit.folder,
    snapshotHash: commit.snapshotHash,
    message: commit.message,
    authorUserId: commit.authorUserId,
    authorDisplayName: commit.authorDisplayName,
    createdAt: commit.createdAt
  });
}

async function snapshotHash(note: Note): Promise<string> {
  return sha256(JSON.stringify({
    title: note.title,
    folder: note.folder,
    content: note.content
  }));
}

export async function createCarrotCommit(
  note: Note,
  user: UserProfile | null,
  message = "Markdown snapshot"
): Promise<CarrotCommit | null> {
  const history = await listCarrotCommits(note.id);
  const parent = history[0] ?? null;
  const nextHash = await snapshotHash(note);

  if (parent?.snapshotHash === nextHash) return null;

  const unsigned = {
    id: crypto.randomUUID(),
    noteId: note.id,
    parentId: parent?.id ?? null,
    title: note.title,
    folder: note.folder,
    content: note.content,
    snapshotHash: nextHash,
    message: message.trim().slice(0, 240) || "Markdown snapshot",
    authorUserId: user?.id ?? "local-anonymous",
    authorDisplayName: user?.displayName ?? "Local user",
    createdAt: new Date().toISOString()
  };

  const payload = carrotSigningPayload(unsigned);

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
    signature,
    publicKey,
    keyId,
    signatureAlgorithm
  };

  await saveCarrotCommit(commit);
  return commit;
}

export async function verifyCarrotCommit(commit: CarrotCommit): Promise<boolean | null> {
  if (
    commit.signatureAlgorithm !== "Ed25519" ||
    !commit.signature ||
    !commit.publicKey ||
    !window.ethicalDesktop?.carrotVerify
  ) {
    return null;
  }

  const payload = carrotSigningPayload({
    id: commit.id,
    noteId: commit.noteId,
    parentId: commit.parentId,
    title: commit.title,
    folder: commit.folder,
    content: commit.content,
    snapshotHash: commit.snapshotHash,
    message: commit.message,
    authorUserId: commit.authorUserId,
    authorDisplayName: commit.authorDisplayName,
    createdAt: commit.createdAt
  });

  return window.ethicalDesktop.carrotVerify(payload, commit.signature, commit.publicKey);
}
