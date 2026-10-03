import type { AgentAction, Note } from "../types";

export interface ParsedAgentResponse {
  content: string;
  actions: AgentAction[];
}

const actionBlockPattern = new RegExp("\\x60\\x60\\x60ethical-actions\\s*([\\s\\S]*?)\\x60\\x60\\x60", "gi");

function nonEmptyString(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) return null;
  return normalized;
}

function optionalString(value: unknown, maxLength: number): string | undefined | null {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.length > maxLength) return null;
  return value;
}

export function validateAgentAction(value: unknown): AgentAction | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const candidate = value as Record<string, unknown>;

  if (candidate.type === "create_note") {
    const title = nonEmptyString(candidate.title, 300);
    const content = optionalString(candidate.content, 20000);
    const folder = optionalString(candidate.folder, 500);
    if (!title || content === null || folder === null) return null;

    return {
      type: "create_note",
      title,
      content: content ?? "",
      ...(folder !== undefined ? { folder } : {})
    };
  }

  if (candidate.type === "update_note") {
    const noteId = nonEmptyString(candidate.noteId, 200);
    const title = optionalString(candidate.title, 300);
    const content = optionalString(candidate.content, 20000);
    const folder = optionalString(candidate.folder, 500);

    if (!noteId || title === null || content === null || folder === null) return null;
    if (title === undefined && content === undefined && folder === undefined) return null;

    return {
      type: "update_note",
      noteId,
      ...(title !== undefined ? { title } : {}),
      ...(content !== undefined ? { content } : {}),
      ...(folder !== undefined ? { folder } : {})
    };
  }

  if (candidate.type === "create_folder") {
    const name = nonEmptyString(candidate.name, 160);
    if (!name) return null;

    let parentPath: string | null | undefined;
    if (candidate.parentPath === undefined) {
      parentPath = undefined;
    } else if (candidate.parentPath === null) {
      parentPath = null;
    } else {
      parentPath = optionalString(candidate.parentPath, 500);
      if (parentPath === null) return null;
    }

    return {
      type: "create_folder",
      name,
      ...(parentPath !== undefined ? { parentPath } : {})
    };
  }

  if (candidate.type === "open_note") {
    const noteId = nonEmptyString(candidate.noteId, 200);
    if (!noteId) return null;
    return { type: "open_note", noteId };
  }

  return null;
}

export function parseAgentResponse(raw: string): ParsedAgentResponse {
  const actions: AgentAction[] = [];
  let matchedActionBlock = false;

  const content = raw.replace(actionBlockPattern, (_match, payload: string) => {
    matchedActionBlock = true;

    try {
      const parsed = JSON.parse(payload) as unknown;
      if (!Array.isArray(parsed)) return "";

      for (const item of parsed.slice(0, 8)) {
        const action = validateAgentAction(item);
        if (action) actions.push(action);
      }
    } catch {
      // Malformed machine data is never executed.
    }

    return "";
  }).trim();

  return {
    content: content || (matchedActionBlock && actions.length > 0
      ? "Připravil jsem návrh akce v Ethical World."
      : raw.trim()),
    actions
  };
}

export function describeAgentAction(action: AgentAction, notes: Note[]): string {
  if (action.type === "create_note") {
    return "Vytvořit poznámku „" + action.title + "“";
  }

  if (action.type === "update_note") {
    const note = notes.find((candidate) => candidate.id === action.noteId);
    return "Upravit poznámku „" + (note?.title ?? action.noteId) + "“";
  }

  if (action.type === "create_folder") {
    const parent = action.parentPath ? action.parentPath + "/" : "";
    return "Vytvořit složku „" + parent + action.name + "“";
  }

  const note = notes.find((candidate) => candidate.id === action.noteId);
  return "Otevřít poznámku „" + (note?.title ?? action.noteId) + "“";
}
