import { gatewayFetch } from "./gateway";
import type { AiMessage, AiPermissionMode, AiProvider, AiSettings, Note, VaultFolder } from "../types";

interface SendAiMessageInput {
  settings: AiSettings;
  messages: AiMessage[];
  notes: Note[];
  folders: VaultFolder[];
  activeNote: Note | null;
  permissionMode: AiPermissionMode;
}

interface ChatResponse {
  content: string;
  provider: string;
  model: string;
}

export interface ProviderStatus {
  online: boolean;
  provider: AiProvider;
  baseUrl: string;
  models: string[];
  model: string | null;
}


export async function checkGatewayHealth(): Promise<boolean> {
  try {
    const response = await gatewayFetch(`/health`, {
      signal: AbortSignal.timeout(2500)
    });

    return response.ok;
  } catch {
    return false;
  }
}

export async function autoDetectLocalProvider(): Promise<ProviderStatus | null> {
  try {
    const response = await gatewayFetch(`/api/providers/auto-detect`, {
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      return null;
    }

    return response.json() as Promise<ProviderStatus>;
  } catch {
    return null;
  }
}

export async function checkProviderStatus(settings: AiSettings): Promise<ProviderStatus | null> {
  try {
    const response = await gatewayFetch(`/api/providers/status`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        provider: settings.provider,
        baseUrl: settings.baseUrl,
        apiKey: settings.apiKey || null
      }),
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      return null;
    }

    return response.json() as Promise<ProviderStatus>;
  } catch {
    return null;
  }
}

export async function sendAiMessage(input: SendAiMessageInput): Promise<ChatResponse> {
  const contextCandidates = [
    ...(input.activeNote ? [input.activeNote] : []),
    ...[...input.notes].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
  ];

  const seenContextIds = new Set<string>();
  const vaultContext = contextCandidates
    .filter((note) => {
      if (seenContextIds.has(note.id)) return false;
      seenContextIds.add(note.id);
      return true;
    })
    .slice(0, 20)
    .map((note) => ({
      id: note.id,
      title: note.title,
      folder: note.folder,
      content: note.content.slice(0, 5000)
    }));

  const response = await gatewayFetch(`/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      provider: input.settings.provider,
      model: input.settings.model,
      baseUrl: input.settings.baseUrl,
      apiKey: input.settings.apiKey || null,
      activeNoteId: input.activeNote?.id ?? null,
      permissionMode: input.permissionMode,
      vaultFolders: input.folders.slice(0, 200).map((folder) => folder.path),
      vaultIndex: input.notes.slice(0, 1000).map((note) => ({
        id: note.id,
        title: note.title,
        folder: note.folder
      })),
      vaultContext,
      messages: input.messages.slice(-40).map(({ role, content }) => ({ role, content: content.slice(0, 20000) }))
    }),
    signal: AbortSignal.timeout(250000)
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { detail?: string } | null;
    throw new Error(payload?.detail ?? `AI request failed (${response.status})`);
  }

  return response.json() as Promise<ChatResponse>;
}
