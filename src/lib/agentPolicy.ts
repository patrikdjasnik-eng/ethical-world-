import type { AgentAction, AiMessage, AiPermissionMode, Note } from "../types";

export interface AutomaticCreationGrant {
  mode: AiPermissionMode;
  scope: string | null;
  isolated: boolean;
}

// Only local UI/request state grants authority. Model flags cannot grant rights.
export function automaticCreationGrant(mode: AiPermissionMode, scope: string | null, notes: Note[], activeNote: Note | null, messages: AiMessage[]): AutomaticCreationGrant {
  return { mode, scope, isolated: notes.length === 0 && activeNote === null && messages.length === 1 && messages[0].role === "user" };
}

export function canAutomaticallyCreate(action: AgentAction, grant: AutomaticCreationGrant, currentMode: AiPermissionMode, currentScope: string | null): boolean {
  return grant.isolated && grant.mode === "agent" && currentMode === "agent" && grant.scope !== null && grant.scope === currentScope && action.type === "create_note" && (action.folder ?? "") === grant.scope;
}
