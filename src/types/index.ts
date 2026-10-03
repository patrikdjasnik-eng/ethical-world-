export type NoteSourceProvider = "local-markdown" | "github" | "notion";

export interface NoteSource {
  provider: NoteSourceProvider;
  connectionId: string;
  relativePath: string;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  folder: string;
  createdAt: string;
  updatedAt: string;
  source?: NoteSource;
}

export interface VaultFolder {
  id: string;
  name: string;
  path: string;
  parentPath: string | null;
  createdAt: string;
  updatedAt: string;
}

export type AiRole = "user" | "assistant";

export interface AiMessage {
  id: string;
  role: AiRole;
  content: string;
}

export type AiProvider = "ollama" | "openai-compatible";

export interface AiSettings {
  provider: AiProvider;
  model: string;
  baseUrl: string;
  apiKey: string;
}

export type AiPermissionMode = "read" | "assist";

export type AgentAction =
  | { type: "create_note"; title: string; content: string; folder?: string; knowledgeNote?: boolean }
  | { type: "update_note"; noteId: string; title?: string; content?: string; folder?: string; knowledgeNote?: boolean }
  | { type: "create_folder"; name: string; parentPath?: string | null }
  | { type: "open_note"; noteId: string };


export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
  role: "owner" | "user";
  mustChangePassword: boolean;
}

export interface AuthSession {
  user: UserProfile;
  sessionToken: string;
  expiresAt: string;
}


export interface CarrotCommit {
  id: string;
  noteId: string;
  parentId: string | null;
  title: string;
  folder: string;
  content: string;
  snapshotHash: string;
  commitHash: string;
  parentCommitHash: string | null;
  message: string;
  authorUserId: string;
  authorDisplayName: string;
  createdAt: string;
  signatureAlgorithm: "Ed25519" | "unsigned-browser";
  signature: string | null;
  publicKey: string | null;
  keyId: string | null;
}
