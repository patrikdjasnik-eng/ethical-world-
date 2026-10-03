import type { AiMessage, AiProvider, AiSettings, Note } from "../types";

interface SendAiMessageInput {
  settings: AiSettings;
  messages: AiMessage[];
  notes: Note[];
  activeNote: Note | null;
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

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8787";

export async function checkGatewayHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${apiUrl}/health`, {
      signal: AbortSignal.timeout(2500)
    });

    return response.ok;
  } catch {
    return false;
  }
}

export async function autoDetectLocalProvider(): Promise<ProviderStatus | null> {
  try {
    const response = await fetch(`${apiUrl}/api/providers/auto-detect`, {
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
    const response = await fetch(`${apiUrl}/api/providers/status`, {
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
  const vaultContext = input.notes.slice(0, 12).map((note) => ({
    id: note.id,
    title: note.title,
    content: note.content.slice(0, 4000)
  }));

  const response = await fetch(`${apiUrl}/api/chat`, {
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
      vaultContext,
      messages: input.messages.map(({ role, content }) => ({ role, content }))
    })
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { detail?: string } | null;
    throw new Error(payload?.detail ?? `AI request failed (${response.status})`);
  }

  return response.json() as Promise<ChatResponse>;
}
