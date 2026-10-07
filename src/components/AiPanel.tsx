import { actionPreview } from "../lib/vaultTools";
import { saveAgentAudit, listAgentAudit } from "../lib/storage";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  autoDetectLocalProvider,
  checkGatewayHealth,
  checkProviderStatus,
  sendAiMessage
} from "../lib/ai";
import { describeAgentAction, parseAgentResponse } from "../lib/agentTools";
import type {
  AgentAction,
  AiMessage,
  AiPermissionMode,
  AiProvider,
  AiSettings,
  Note,
  VaultFolder
} from "../types";

interface AiPanelProps {
  activeNote: Note | null;
  notes: Note[];
  folders: VaultFolder[];
  visible: boolean;
  onRequestHide: () => void;
  onApplyAgentAction: (action: AgentAction) => Promise<string>;
}

interface ConnectionState {
  backendOnline: boolean;
  modelOnline: boolean;
  checking: boolean;
}

interface PendingAction {
  id: string;
  action: AgentAction;
}

const initialMessage: AiMessage = {
  id: "welcome",
  role: "assistant",
  content: "Jsem Máša. Můžu odpovídat i na obecné technické a cybersecurity dotazy. V režimu ASSIST umím navíc připravovat změny v Ethical World, které před provedením vždy potvrdíš."
};

function looksLikeActionRequest(value: string): boolean {
  return /(vytvoř|vytvor|udělej|udelej|uprav|přidej|pridej|přepiš|prepis|zapiš|zapis|ulož|uloz|otevři|otevri|doplň|dopln|vlož|vloz|zapracuj|zakresli|rozšiř|rozsir|aktualizuj|create|update|edit|append|open|folder|note|složk|slozk|poznámk|poznamk)/i.test(value);
}

function looksLikeKnowledgeNoteRequest(value: string): boolean {
  return /(poznám|poznam|markdown|(?:^|\s)md(?:\s|$)|(?:^|\s)note(?:\s|$)|dokument)/i.test(value) &&
    /(vytvoř|vytvor|udělej|udelej|napiš|napis|zpracuj|připrav|priprav|přepracuj|prepracuj|uprav|přidej|pridej|doplň|dopln|vlož|vloz|zapracuj|zakresli|rozšiř|rozsir|aktualizuj|create|write|update|edit|append)/i.test(value);
}

function createId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  // Some renderer contexts expose secure random bytes without randomUUID.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export const AiPanel = memo(function AiPanel({
  activeNote,
  notes,
  folders,
  visible,
  onRequestHide,
  onApplyAgentAction
}: AiPanelProps) {
  const [messages, setMessages] = useState<AiMessage[]>([initialMessage]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const sendLock = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [permissionMode, setPermissionMode] = useState<AiPermissionMode>("assist");
  const permissionRef = useRef<AiPermissionMode>("assist");
  const [agentScope, setAgentScope] = useState<string | null>(null);
  const scopeRef = useRef<string | null>(null);
  const actionLock = useRef(false);
  const changePermission = (mode: AiPermissionMode) => {
    permissionRef.current = mode;
    setPermissionMode(mode);
    setPendingActions([]);
    scopeRef.current = null;
    setAgentScope(null);
  };
  const executeAction = useCallback(async (action: AgentAction): Promise<string> => {
    if (permissionRef.current === "read") throw new Error("READ režim nemůže měnit vault.");
    const id = createId();
    const entry = { id, createdAt: new Date().toISOString(), actionType: action.type, ...("noteId" in action ? { noteId: action.noteId } : {}), result: "started" };
    await saveAgentAudit(entry);
    try {
      const result = await onApplyAgentAction(action);
      try { await saveAgentAudit({ ...entry, result }); }
      catch { return result + " Změna proběhla, ale auditní výsledek se nepodařilo uložit."; }
      return result;
    } catch (error) {
      await saveAgentAudit({ ...entry, result: "failed: " + (error instanceof Error ? error.message : "unknown") }).catch(() => undefined);
      throw error;
    }
  }, [onApplyAgentAction]);

  const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);
  const [applyingActionId, setApplyingActionId] = useState<string | null>(null);
  const [sendingMode, setSendingMode] = useState<"answer" | "proposal" | "knowledge">("answer");
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const messageListRef = useRef<HTMLDivElement | null>(null);
  const messageEndRef = useRef<HTMLDivElement | null>(null);
  const [connection, setConnection] = useState<ConnectionState>({
    backendOnline: false,
    modelOnline: false,
    checking: true
  });
  const [settings, setSettings] = useState<AiSettings>({
    provider: "ollama",
    model: "masa-cyber",
    baseUrl: "http://localhost:11434",
    apiKey: ""
  });

  const refreshConnection = useCallback(async (allowAutoDetect = false) => {
    setConnection((current) => ({ ...current, checking: true }));

    const backendOnline = await checkGatewayHealth();

    if (!backendOnline) {
      setConnection({ backendOnline: false, modelOnline: false, checking: false });
      return;
    }

    if (allowAutoDetect) {
      const detected = await autoDetectLocalProvider();

      if (detected?.online && detected.model) {
        setSettings((current) => ({
          ...current,
          provider: detected.provider,
          baseUrl: detected.baseUrl,
          model: detected.model ?? current.model
        }));
        setConnection({ backendOnline: true, modelOnline: true, checking: false });
        return;
      }
    }

    const status = await checkProviderStatus(settings);
    setConnection({
      backendOnline: true,
      modelOnline: Boolean(status?.online),
      checking: false
    });

    if (status?.online && status.model && !status.models.includes(settings.model)) {
      setSettings((current) => ({ ...current, model: status.model ?? current.model }));
    }
  }, [settings]);

  useEffect(() => {
    void refreshConnection(true);
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void refreshConnection(false);
    }, 10000);

    return () => window.clearInterval(interval);
  }, [refreshConnection]);

  const updateProvider = useCallback((provider: AiProvider) => {
    setSettings((current) => ({
      ...current,
      provider,
      baseUrl: provider === "ollama" ? "http://localhost:11434" : "http://localhost:8080/v1",
      model: provider === "ollama" ? "masa-cyber" : "local-model"
    }));
  }, []);

  const status = useMemo(() => {
    if (isSending) return { text: "Čekám na odpověď…", className: "checking" };
    if (connection.checking) return { text: "Kontroluju…", className: "checking" };
    if (!connection.backendOnline) return { text: "Backend offline", className: "offline" };
    if (!connection.modelOnline) return { text: "LLM offline", className: "warning" };
    return { text: "Online", className: "online" };
  }, [connection, isSending]);

  const canSend = !isSending && applyingActionId === null;

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isSending, pendingActions.length]);

  const copyMessage = useCallback(async (message: AiMessage) => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopiedMessageId(message.id);
      window.setTimeout(() => setCopiedMessageId((current) => current === message.id ? null : current), 1400);
    } catch {
      setError("Odpověď se nepodařilo zkopírovat do schránky.");
    }
  }, []);

  const submit = useCallback(async (draft: string) => {
    const trimmedInput = draft.trim();
    if (!trimmedInput || !canSend || sendLock.current) return;
    sendLock.current = true;
    let submittedId: string | null = null;
    let responseAdded = false;
    setIsSending(true);
    setError(null);

    try {
      const userMessage: AiMessage = { id: createId(), role: "user", content: trimmedInput };
      submittedId = userMessage.id;
      const nextMessages = [...messages, userMessage];
      setMessages(nextMessages);
      setInput("");
      setSendingMode(
        permissionMode !== "read" && looksLikeKnowledgeNoteRequest(trimmedInput)
          ? "knowledge"
          : looksLikeActionRequest(trimmedInput) && permissionMode !== "read"
            ? "proposal"
            : "answer"
      );
      const response = await sendAiMessage({
        settings,
        messages: nextMessages,
        notes,
        folders,
        activeNote,
        permissionMode,
        agentScope: scopeRef.current
      });
      const parsed = parseAgentResponse(response.content, notes);
      if (parsed.warning) setError(parsed.warning);
      const unsafeUpdates = parsed.actions.filter((action) => action.type === "update_note" && action.content !== undefined && !response.completeNoteIds?.includes(action.noteId));
      if (unsafeUpdates.length) {
        parsed.actions = parsed.actions.filter((action) => !unsafeUpdates.includes(action));
        setError("Přepis odmítnut: model neměl úplný obsah cílové poznámky. Otevři ji nebo pracuj po menších poznámkách; původní obsah zůstává uložený.");
      }

      const assistantMessage: AiMessage = { id: createId(), role: "assistant", content: parsed.content };
      setMessages((current) => [...current, assistantMessage]);
      responseAdded = true;

      if (permissionRef.current !== "read" && permissionRef.current === permissionMode && parsed.actions.length > 0) {
        const pending: PendingAction[] = [];
        for (const [index, action] of parsed.actions.entries()) {
          const allowed = permissionMode === "agent" && scopeRef.current !== null && action.type === "create_note" && (action.folder ?? "") === scopeRef.current;
          if (allowed) {
            try {
              const result = await executeAction(action);
              const actionMessage: AiMessage = { id: createId(), role: "assistant", content: "✓ " + result };
              setMessages((current) => [...current, actionMessage]);
            } catch (error) {
              setError(error instanceof Error ? error.message : "Agentní akce selhala.");
              pending.push(...parsed.actions.slice(index).map((item) => ({ id: createId(), action: item })));
              break;
            }
          } else pending.push({ id: createId(), action });
        }
        setPendingActions((current) => [
          ...current,
          ...pending
        ]);
      }
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "AI request failed");
      if (!responseAdded) {
        setMessages((current) => current.filter((message) => message.id !== submittedId));
        setInput((current) => current || draft);
      }
      void refreshConnection(false);
    } finally {
      sendLock.current = false;
      setIsSending(false);
    }
  }, [activeNote, canSend, folders, messages, notes, permissionMode, refreshConnection, settings, executeAction]);

  const applyAction = useCallback(async (pending: PendingAction) => {
    if (actionLock.current || isSending) return;
    actionLock.current = true;
    setApplyingActionId(pending.id);
    setError(null);

    try {
      const result = await executeAction(pending.action);
      setPendingActions((current) => current.filter((candidate) => candidate.id !== pending.id));
      const actionMessage: AiMessage = { id: createId(), role: "assistant", content: "✓ " + result };
      setMessages((current) => [...current, actionMessage]);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Akci se nepodařilo provést");
    } finally {
      setApplyingActionId(null);
      actionLock.current = false;
    }
  }, [executeAction, isSending]);

  const applyAllActions = useCallback(async () => {
    if (actionLock.current || isSending) return;
    actionLock.current = true;
    const queued = [...pendingActions];

    for (const pending of queued) {
      setApplyingActionId(pending.id);
      try {
        const result = await executeAction(pending.action);
        setPendingActions((current) => current.filter((candidate) => candidate.id !== pending.id));
        const actionMessage: AiMessage = { id: createId(), role: "assistant", content: result };
        setMessages((current) => [...current, actionMessage]);
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "Akci se nepodařilo provést");
        break;
      } finally {
        setApplyingActionId(null);
      }
    }
    actionLock.current = false;
  }, [executeAction, pendingActions, isSending]);

  return (
    <aside className={"ai-panel " + (visible ? "" : "ai-hidden")} aria-hidden={!visible}>
      <div className="pane-titlebar">
        <span>Assistant · {permissionMode.toUpperCase()}</span>
        <span className="pane-actions">
          <button type="button" onClick={onRequestHide} title="Minimalizovat Mášu do lišty">−</button>
          <button type="button" onClick={onRequestHide} title="Skrýt Mášu bez ztráty konverzace">×</button>
        </span>
      </div>

      <div className="ai-header">
        <div className="ai-avatar">M</div>
        <div>
          <span className={"ai-status-dot " + status.className} />
          <strong>Máša</strong>
          <small>{status.text} · {settings.model}</small>
        </div>
        <button className="icon-button" type="button" onClick={() => setShowSettings((value) => !value)} title="AI nastavení">
          ⚙
        </button>
      </div>

      {showSettings && (
        <div className="ai-settings">
          <label>
            Agent permissions
            <select value={permissionMode} disabled={isSending || applyingActionId !== null} onChange={(event) => changePermission(event.target.value as AiPermissionMode)}>
              <option value="read">READ · pouze čtení</option>
              <option value="assist">ASSIST · změny po potvrzení</option>
              <option value="agent">AGENT · nové poznámky ve schválené složce</option>
            </select>
          </label>

          {permissionMode === "agent" && <label>
            Automatické vytváření pouze v této složce (ostatní změny vyžadují potvrzení)
            <select aria-label="Agent scope" disabled={isSending || applyingActionId !== null} value={agentScope ?? "__none"} onChange={(event) => {
              const scope = event.target.value === "__none" ? null : event.target.value;
              scopeRef.current = scope;
              setAgentScope(scope);
            }}>
              <option value="__none">Bez oprávnění k automatickému zápisu</option>
              <option value="">Root</option>
              {folders.map((folder) => <option key={folder.id} value={folder.path}>{folder.path}</option>)}
            </select>
          </label>}
          <button type="button" onClick={() => void listAgentAudit().then((entries) => {
            const blob = new Blob([JSON.stringify(entries, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a"); link.href = url; link.download = "masa-audit.json"; link.click(); URL.revokeObjectURL(url);
          }).catch((error: unknown) => setError(error instanceof Error ? error.message : "Audit export selhal."))}>Export auditního logu</button>
          <label>
            Provider
            <select value={settings.provider} onChange={(event) => updateProvider(event.target.value as AiProvider)}>
              <option value="ollama">Ollama</option>
              <option value="openai-compatible">OpenAI-compatible</option>
            </select>
          </label>

          <label>
            Model
            <input value={settings.model} onChange={(event) => setSettings((current) => ({ ...current, model: event.target.value }))} />
          </label>

          <label>
            Base URL
            <input value={settings.baseUrl} onChange={(event) => setSettings((current) => ({ ...current, baseUrl: event.target.value }))} />
          </label>

          {settings.provider === "openai-compatible" && (
            <label>
              API key
              <input
                type="password"
                value={settings.apiKey}
                onChange={(event) => setSettings((current) => ({ ...current, apiKey: event.target.value }))}
                placeholder="volitelné pro lokální server"
                autoComplete="off"
              />
            </label>
          )}

          <button className="secondary-button" type="button" onClick={() => void refreshConnection(true)}>
            Znovu najít lokální AI
          </button>
          <p>ASSIST změny potvrzuješ. AGENT může vytvářet nové poznámky pouze v předem zvolené složce; úpravy stále potvrzuješ. Máša nespouští skripty a nemaže poznámky.</p>
        </div>
      )}

      {!connection.modelOnline && !connection.checking && (
        <div className="ai-offline-banner">
          <strong>Máša čeká na model.</strong>
          <span>
            {connection.backendOnline
              ? "Spusť Ollamu nebo llama-server. Ethical World je automaticky zkusí najít."
              : window.ethicalDesktop
                ? "Desktop runtime backend se nepodařilo spustit. Zkus aplikaci restartovat."
                : "Spusť FastAPI backend na portu 8787."}
          </span>
          <button type="button" onClick={() => void refreshConnection(true)}>Zkontrolovat znovu</button>
        </div>
      )}

      <div className="ai-context">
        <span>Context · {permissionMode.toUpperCase()}</span>
        <strong>{activeNote?.title ?? "žádná poznámka"}</strong>
        <small>
          {notes.length} notes · {folders.length} folders · {permissionMode !== "read" ? "actions require approval" : "read only"}
        </small>
      </div>

      <div className="message-list" ref={messageListRef}>
        {messages.map((message) => (
          <div className={"message " + message.role} key={message.id}>
            <div className="message-meta">
              <span>{message.role === "assistant" ? "Máša" : "Ty"}</span>
              {message.role === "assistant" && (
                <button
                  type="button"
                  className="message-copy"
                  onClick={() => void copyMessage(message)}
                  title="Kopírovat odpověď"
                >
                  {copiedMessageId === message.id ? "Zkopírováno" : "Kopírovat"}
                </button>
              )}
            </div>
            <p>{message.content}</p>
          </div>
        ))}
        {isSending && (
          <div className="message assistant message-working">
            <span>Máša</span>
            <p>
              {sendingMode === "knowledge"
                ? "Skládám kompletní Markdown poznámku, schémata a vazby…"
                : sendingMode === "proposal"
                  ? "Připravuju změnu v Ethical World…"
                  : "Přemýšlím nad odpovědí…"}
            </p>
          </div>
        )}
        <div ref={messageEndRef} />
      </div>

      {pendingActions.length > 0 && (
        <section className="agent-actions" aria-label="Máša navržené akce">
          <div className="agent-actions-heading">
            <strong>Navržené akce</strong>
            <div>
              {pendingActions.length > 1 && (
                <button type="button" disabled={applyingActionId !== null || isSending || permissionMode === "read"} onClick={() => void applyAllActions()}>
                  Použít vše
                </button>
              )}
              <button type="button" disabled={applyingActionId !== null || isSending || permissionMode === "read"} onClick={() => setPendingActions([])}>
                Zahodit vše
              </button>
            </div>
          </div>

          {pendingActions.map((pending) => (
            <div className="agent-action-card" key={pending.id}>
              <span>{permissionMode.toUpperCase()} · čeká na potvrzení</span>
              <strong>{describeAgentAction(pending.action, notes)}</strong>
              <details><summary>Náhled změny</summary><pre>{(() => {
                try { return actionPreview(pending.action, notes); }
                catch (error) { return error instanceof Error ? error.message : "Náhled nelze vytvořit."; }
              })()}</pre></details>
              <div>
                <button
                  type="button"
                  className="agent-apply"
                  disabled={applyingActionId !== null || isSending || permissionMode === "read"}
                  onClick={() => void applyAction(pending)}
                >
                  {applyingActionId === pending.id ? "Provádím…" : "Použít"}
                </button>
                <button
                  type="button"
                  disabled={applyingActionId !== null || isSending || permissionMode === "read"}
                  onClick={() => setPendingActions((current) => current.filter((candidate) => candidate.id !== pending.id))}
                >
                  Zahodit
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      {error && <div className="ai-error" role="alert">{error}</div>}

      <form className="chat-composer" onSubmit={(event) => {
        event.preventDefault();
        const draft = new FormData(event.currentTarget).get("message");
        void submit(typeof draft === "string" ? draft : "");
      }}>
        <textarea
          name="message"
          aria-label="Zpráva Máše"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && event.keyCode !== 229) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
          placeholder={connection.modelOnline ? "Řekni Máše, co má v Ethical World udělat…" : "AI je offline – nejdřív spusť lokální model"}
          rows={3}
        />
        <button className="primary-button" type="submit" disabled={!canSend}>
          {isSending ? "…" : "Send"}
        </button>
      </form>
    </aside>
  );
});

export default AiPanel;
