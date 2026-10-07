import { searchNotes, findRelatedNotes } from "./vaultTools";
import { gatewayFetch, gatewayStream } from "./gateway";
import { automaticCreationGrant } from "./agentPolicy";
import type { AiMessage, AiMetrics, AiPermissionMode, AiProvider, AiSettings, Note, VaultFolder } from "../types";

interface SendAiMessageInput {
  settings: AiSettings;
  messages: AiMessage[];
  notes: Note[];
  folders: VaultFolder[];
  activeNote: Note | null;
  permissionMode: AiPermissionMode;
  agentScope?: string | null;
  signal?: AbortSignal;
  onProgress?: (progress: { content: string; workload?: "chat" | "vault" | "document" }) => void;
}

interface ChatResponse {
  completeNoteIds: string[];
  content: string;
  provider: string;
  model: string;
  metrics?: AiMetrics;
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
  const query = input.messages.at(-1)?.content ?? "";
  if (query.length > 20000) throw new Error("Zpráva překračuje limit 20 000 znaků. Rozděl zadání na menší části; původní text zůstal rozepsaný.");
  const retrievalQuery = query.replace(/\b(?:jak|co|je|jsou|to|mi|do|se|si|na|v|ve|a|o|the|what|how|is|are|please)\b|(?:vysvětli|vysvetli|prosím|prosim|napiš|napis|udělej|udelej)/gi, " ");
  const recentConversation = input.messages.slice(-7, -1).map((message) => message.content).join("\n");
  const followup = /(do nich|všech|vsech|těch|tech|tří|tri|them|those)/i.test(query);
  const referencedNotes = followup ? input.notes.filter((note) => recentConversation.includes(note.id) || recentConversation.includes(note.title)) : [];
  const contextCandidates = [
    ...referencedNotes,
    ...(input.activeNote ? [input.activeNote] : []),
    ...searchNotes(input.notes, retrievalQuery, 8),
    ...(input.activeNote ? findRelatedNotes(input.notes, input.activeNote.id) : [])
  ];

  const seenContextIds = new Set<string>();
  const vaultContext = contextCandidates
    .filter((note) => {
      if (seenContextIds.has(note.id)) return false;
      seenContextIds.add(note.id);
      return true;
    })
    .slice(0, 8)
    .map((note) => ({
      id: note.id,
      title: note.title,
      folder: note.folder,
      content: note.content.slice(0, 10000),
      complete: !note.source?.incomplete && note.content.length <= 10000
    }));

  // Metadata preserves discovery without injecting unrelated note bodies into every prompt.
  const indexCandidates = [...contextCandidates, ...[...input.notes].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))];
  const seenIndexIds = new Set<string>();
  const vaultIndex = indexCandidates.filter((note) => {
    if (seenIndexIds.has(note.id)) return false;
    seenIndexIds.add(note.id);
    return true;
  }).slice(0, 500).map(({ id, title, folder }) => ({ id, title, folder }));

  const grant = automaticCreationGrant(input.permissionMode, input.agentScope ?? null, input.notes, input.activeNote, input.messages);
  const isolatedAgent = grant.mode === "agent" && grant.scope !== null && grant.isolated;
  const body = JSON.stringify({
      provider: input.settings.provider,
      model: input.settings.model,
      baseUrl: input.settings.baseUrl,
      apiKey: input.settings.apiKey || null,
      activeNoteId: input.activeNote?.id ?? null,
      permissionMode: input.permissionMode,
      responseStyle: input.settings.responseStyle ?? "fast",
      agentScope: input.agentScope ?? null,
      // An isolated creation needs only the explicitly selected scope from UI.
      // Do not add unrelated, potentially imported folder names to that request.
      vaultFolders: isolatedAgent ? [] : input.folders.slice(0, 200).map((folder) => folder.path),
      vaultIndex,
      vaultContext,
      messages: input.messages.slice(-20).map(({ role, content }) => {
        const marker = "\n[ZKRÁCENÁ STARŠÍ ZPRÁVA: nejde o úplný dokument.]";
        return { role, content: content.length <= 20000 ? content : content.slice(0, 20000 - marker.length) + marker };
      })
    });
  const signal = input.signal ? AbortSignal.any([input.signal, AbortSignal.timeout(250000)]) : AbortSignal.timeout(250000);
  if (input.settings.provider === "ollama" && input.onProgress && (!window.ethicalDesktop || window.ethicalDesktop.gatewayStreamRequest)) {
    let content = "";
    let workload: "chat" | "vault" | "document" | undefined;
    const result = await gatewayStream(body, (value) => {
      if (!value || typeof value !== "object") throw new Error("Neplatná průběžná odpověď.");
      const event = value as { type?: string; content?: unknown; workload?: string };
      if (event.type === "start" && ["chat", "vault", "document"].includes(event.workload ?? "")) workload = event.workload as typeof workload;
      if (event.type === "delta") {
        if (typeof event.content !== "string") throw new Error("Neplatný průběžný text.");
        content += event.content;
      }
      const machineStart = content.search(/(?:^|\n)\s*(?:<ethical-|\x60\x60\x60ethical-)/i);
      input.onProgress?.({ content: workload === "document" ? "" : machineStart >= 0 ? content.slice(0, machineStart) : content, workload });
    }, signal);
    if (!result || typeof result !== "object" || typeof (result as ChatResponse).content !== "string") throw new Error("Model nedokončil odpověď.");
    return result as ChatResponse;
  }
  const response = await gatewayFetch(`/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body, signal
  });
  if (signal.aborted) throw new DOMException("Aborted", "AbortError");

  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { detail?: string } | null;
    throw new Error(payload?.detail ?? `AI request failed (${response.status})`);
  }

  return response.json() as Promise<ChatResponse>;
}
