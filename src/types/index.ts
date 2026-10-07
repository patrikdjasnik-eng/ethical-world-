export type NoteSourceProvider = "local-markdown" | "github" | "notion";

export interface NoteSource {
  provider: NoteSourceProvider;
  connectionId: string;
  relativePath: string;
  baselineContent?: string;
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

export interface AiMetrics {
  elapsedMs: number;
  firstTokenMs?: number | null;
  firstVisibleMs?: number;
  roundTripMs?: number;
  promptChars: number;
  historyMessages: number;
  contextNotes: number;
  workload: "chat" | "vault" | "document";
  inputTokens: number | null;
  outputTokens: number | null;
  loadMs: number | null;
  promptMs: number | null;
  generationMs: number | null;
  tokensPerSecond: number | null;
  truncated?: boolean;
}

export interface AiMessage {
  id: string;
  role: AiRole;
  content: string;
  metrics?: AiMetrics;
  model?: string;
  provider?: AiProvider;
}

export type AiProvider = "ollama" | "openai-compatible";

export interface AiSettings {
  provider: AiProvider;
  model: string;
  baseUrl: string;
  apiKey: string;
  responseStyle?: "fast" | "balanced" | "detailed";
}

export type AiPermissionMode = "read" | "assist" | "agent";

export type AgentAction = (
  | { type: "create_note"; title: string; content: string; folder?: string; knowledgeNote?: boolean }
  | { type: "update_note"; noteId: string; title?: string; content?: string; folder?: string; knowledgeNote?: boolean }
  | { type: "create_folder"; name: string; parentPath?: string | null }
  | { type: "open_note"; noteId: string }
  | { type: "rename_note"; noteId: string; title: string }
  | { type: "move_note"; noteId: string; folder: string }
  | { type: "link_notes"; noteId: string; targetNoteId: string }
  | { type: "create_task"; noteId: string; text: string }
) & { expectedUpdatedAt?: string; expectedSnapshot?: string };

export interface AgentAuditEntry {
  id: string;
  createdAt: string;
  actionType: AgentAction["type"];
  noteId?: string;
  result: string;
}


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
