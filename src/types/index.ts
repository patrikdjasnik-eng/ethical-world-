export interface Note {
  id: string;
  title: string;
  content: string;
  folder: string;
  createdAt: string;
  updatedAt: string;
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
