import type { AgentAction, Note } from "../types";

export interface ParsedAgentResponse {
  content: string;
  actions: AgentAction[];
  warning?: string;
}

const actionBlockPattern = new RegExp("\\x60\\x60\\x60ethical-actions\\s*([\\s\\S]*?)\\x60\\x60\\x60", "gi");
const knowledgeNotePattern = /<ethical-note>\s*(\{[^\r\n]+\})\s*<content>\s*([\s\S]*?)\s*<\/content>\s*<\/ethical-note>/gi;

const knowledgeBadges = [
  "![Ethical World](https://img.shields.io/badge/Ethical_World-Knowledge-6f42c1)",
  "![Máša](https://img.shields.io/badge/M%C3%A1%C5%A1a-AI--authored-111827)",
  "![Markdown](https://img.shields.io/badge/format-Markdown-0ea5e9)"
].join(" ");

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

function normalizeTitle(value: string): string {
  return value.trim().toLocaleLowerCase("cs-CZ");
}

function normalizeLegacyAction(value: unknown): unknown[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [value];

  const candidate = value as Record<string, unknown>;
  const action = typeof candidate.action === "string" ? candidate.action : null;

  if (action === "create_notes" && Array.isArray(candidate.notes)) {
    return candidate.notes.slice(0, 8).map((note) => {
      if (!note || typeof note !== "object" || Array.isArray(note)) return note;
      return {
        type: "create_note",
        ...(note as Record<string, unknown>)
      };
    });
  }

  if (!action || candidate.type !== undefined) return [value];

  const nestedNote =
    candidate.note && typeof candidate.note === "object" && !Array.isArray(candidate.note)
      ? candidate.note as Record<string, unknown>
      : {};

  if (action === "create_note") {
    return [{
      type: "create_note",
      ...nestedNote,
      ...(candidate.title !== undefined ? { title: candidate.title } : {}),
      ...(candidate.content !== undefined ? { content: candidate.content } : {}),
      ...(candidate.folder !== undefined ? { folder: candidate.folder } : {})
    }];
  }

  if (action === "update_note") {
    return [{
      type: "update_note",
      ...nestedNote,
      ...(candidate.noteId !== undefined ? { noteId: candidate.noteId } : {}),
      ...(candidate.title !== undefined ? { title: candidate.title } : {}),
      ...(candidate.content !== undefined ? { content: candidate.content } : {}),
      ...(candidate.folder !== undefined ? { folder: candidate.folder } : {})
    }];
  }

  if (action === "create_folder") {
    return [{
      type: "create_folder",
      ...(candidate.name !== undefined ? { name: candidate.name } : {}),
      ...(candidate.parentPath !== undefined ? { parentPath: candidate.parentPath } : {})
    }];
  }

  if (action === "open_note") {
    return [{
      type: "open_note",
      ...(candidate.noteId !== undefined ? { noteId: candidate.noteId } : {})
    }];
  }

  return [value];
}

function sanitizeWikiLinks(
  markdown: string,
  notes: Note[],
  extraTitles: string[] = []
): string {
  const knownTitles = new Set([
    ...notes.map((note) => normalizeTitle(note.title)),
    ...extraTitles.map((title) => normalizeTitle(title))
  ]);

  return markdown.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_match, rawTarget: string, rawAlias?: string) => {
    const target = rawTarget.trim();
    const alias = rawAlias?.trim();

    if (knownTitles.has(normalizeTitle(target))) {
      return alias ? `[[${target}|${alias}]]` : `[[${target}]]`;
    }

    return alias || target;
  });
}

export function finalizeKnowledgeMarkdown(
  markdown: string,
  title: string,
  notes: Note[],
  extraTitles: string[] = []
): string {
  let body = markdown.replace(/^\uFEFF/, "").trim();

  if (!/^#\s+/m.test(body)) {
    body = `# ${title}\n\n${body}`;
  }

  body = sanitizeWikiLinks(body, notes, extraTitles);

  if (!/img\.shields\.io\/badge\/Ethical_World-/i.test(body)) {
    body = `${knowledgeBadges}\n\n${body}`;
  }

  return body.trim();
}

export function validateAgentAction(value: unknown): AgentAction | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;

  if (candidate.type === "create_note") {
    const title = nonEmptyString(candidate.title, 300);
    const content = optionalString(candidate.content, 60000);
    const folder = optionalString(candidate.folder, 500);
    if (!title || content === null || folder === null) return null;
    return {
      type: "create_note",
      title,
      content: content ?? "",
      ...(folder !== undefined ? { folder } : {}),
      ...(candidate.knowledgeNote === true ? { knowledgeNote: true } : {})
    };
  }

  if (candidate.type === "update_note") {
    const noteId = nonEmptyString(candidate.noteId, 200);
    const title = optionalString(candidate.title, 300);
    const content = optionalString(candidate.content, 60000);
    const folder = optionalString(candidate.folder, 500);
    if (!noteId || title === null || content === null || folder === null) return null;
    if (title === undefined && content === undefined && folder === undefined) return null;
    return {
      type: "update_note",
      noteId,
      ...(title !== undefined ? { title } : {}),
      ...(content !== undefined ? { content } : {}),
      ...(folder !== undefined ? { folder } : {}),
      ...(candidate.knowledgeNote === true ? { knowledgeNote: true } : {})
    };
  }

  if (candidate.type === "create_folder") {
    const name = nonEmptyString(candidate.name, 160);
    if (!name) return null;
    let parentPath: string | null | undefined;
    if (candidate.parentPath === undefined) parentPath = undefined;
    else if (candidate.parentPath === null) parentPath = null;
    else {
      parentPath = optionalString(candidate.parentPath, 500);
      if (parentPath === null) return null;
    }
    return { type: "create_folder", name, ...(parentPath !== undefined ? { parentPath } : {}) };
  }

  if (["rename_note", "move_note", "link_notes", "create_task"].includes(String(candidate.type))) {
    const noteId = nonEmptyString(candidate.noteId, 200);
    if (!noteId) return null;
    if (candidate.type === "rename_note") {
      const title = nonEmptyString(candidate.title, 300);
      return title ? { type: "rename_note", noteId, title } : null;
    }
    if (candidate.type === "move_note") {
      const folder = optionalString(candidate.folder, 500);
      return typeof folder === "string" ? { type: "move_note", noteId, folder } : null;
    }
    if (candidate.type === "link_notes") {
      const targetNoteId = nonEmptyString(candidate.targetNoteId, 200);
      return targetNoteId ? { type: "link_notes", noteId, targetNoteId } : null;
    }
    const text = nonEmptyString(candidate.text, 1000);
    return text && !/[\r\n]/.test(text) ? { type: "create_task", noteId, text } : null;
  }

  if (candidate.type === "open_note") {
    const noteId = nonEmptyString(candidate.noteId, 200);
    if (!noteId) return null;
    return { type: "open_note", noteId };
  }

  return null;
}

function parseKnowledgeEnvelope(
  metadataRaw: string,
  markdownRaw: string,
  notes: Note[],
  batchTitles: string[] = []
): AgentAction | null {
  let metadata: Record<string, unknown>;
  try {
    const parsed = JSON.parse(metadataRaw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    metadata = parsed as Record<string, unknown>;
  } catch {
    return null;
  }

  if (!["create", "update"].includes(String(metadata.action)) || markdownRaw.length > 60000) return null;
  const action = metadata.action === "update" ? "update" : "create";
  const title = nonEmptyString(metadata.title, 300);
  const folder = optionalString(metadata.folder, 500);
  if (!title || folder === null) return null;
  const content = finalizeKnowledgeMarkdown(
    markdownRaw,
    title,
    notes,
    batchTitles
  );

  if (action === "update") {
    const noteId = nonEmptyString(metadata.noteId, 200);
    if (!noteId) return null;
    return {
      type: "update_note", noteId, title, content,
      ...(folder !== undefined ? { folder } : {}),
      knowledgeNote: true
    };
  }

  return {
    type: "create_note", title, content,
    ...(folder !== undefined ? { folder } : {}),
    knowledgeNote: true
  };
}

export function parseAgentResponse(raw: string, notes: Note[] = []): ParsedAgentResponse {
  const actions: AgentAction[] = [];
  let matchedMachineBlock = false;
  const batchTitles: string[] = [];

  const scanPattern = new RegExp(knowledgeNotePattern.source, "gi");
  for (const match of raw.matchAll(scanPattern)) {
    try {
      const metadata = JSON.parse(match[1]) as Record<string, unknown>;
      if (typeof metadata.title === "string" && metadata.title.trim()) {
        batchTitles.push(metadata.title.trim());
      }
    } catch {
      // Invalid metadata is ignored by the actual parser below.
    }
  }

  let content = raw.replace(knowledgeNotePattern, (_match, metadataRaw: string, markdownRaw: string) => {
    matchedMachineBlock = true;
    const action = parseKnowledgeEnvelope(metadataRaw, markdownRaw, notes, batchTitles);
    if (action) actions.push(action);
    return "";
  });

  content = content.replace(actionBlockPattern, (_match, payload: string) => {
    matchedMachineBlock = true;
    try {
      const parsed = JSON.parse(payload) as unknown;
      if (!Array.isArray(parsed)) return "";
      for (const item of parsed.slice(0, 8)) {
        for (const normalized of normalizeLegacyAction(item)) {
          const action = validateAgentAction(normalized);
          if (action) actions.push(action);
          if (actions.length >= 8) break;
        }
        if (actions.length >= 8) break;
      }
    } catch {
      // Malformed machine data is never executed.
    }
    return "";
  }).trim();

  return {
    ...(matchedMachineBlock && actions.length === 0 ? { warning: "Model vrátil neplatný nebo nepodporovaný návrh. Nic se neprovedlo; požádej o nový návrh." } : {}),
    ...(actions.length > 8 ? { warning: "Návrh přesáhl limit 8 akcí. Připrav další položky v samostatné odpovědi." } : {}),
    content: content || (matchedMachineBlock && actions.length > 0
      ? "Připravil jsem návrh změny v Ethical World."
      : raw.trim()),
    actions: actions.slice(0, 8).map((action) => {
      if (!("noteId" in action) || action.type === "open_note") return action;
      const note = notes.find((candidate) => candidate.id === action.noteId);
      return note ? { ...action, expectedUpdatedAt: note.updatedAt, expectedSnapshot: JSON.stringify([note.title, note.folder, note.content]) } : action;
    })
  };
}

export function describeAgentAction(action: AgentAction, notes: Note[]): string {
  if (action.type === "create_note") {
    return (action.knowledgeNote ? "Vytvořit kompletní knowledge note „" : "Vytvořit poznámku „") + action.title + "“";
  }
  if (action.type === "update_note") {
    const note = notes.find((candidate) => candidate.id === action.noteId);
    return (action.knowledgeNote ? "Přepracovat knowledge note „" : "Upravit poznámku „") + (note?.title ?? action.noteId) + "“";
  }
  if (action.type === "create_folder") {
    const parent = action.parentPath ? action.parentPath + "/" : "";
    return "Vytvořit složku „" + parent + action.name + "“";
  }
  const note = notes.find((candidate) => candidate.id === action.noteId);
  const label = action.type === "rename_note" ? "Přejmenovat" : action.type === "move_note" ? "Přesunout" : action.type === "link_notes" ? "Propojit" : action.type === "create_task" ? "Přidat úkol do" : "Otevřít";
  return label + " poznámku „" + (note?.title ?? action.noteId) + "“";
}
