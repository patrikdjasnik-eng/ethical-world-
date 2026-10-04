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
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [permissionMode, setPermissionMode] = useState<AiPermissionMode>("assist");
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
    if (connection.checking) return { text: "Kontroluju…", className: "checking" };
    if (!connection.backendOnline) return { text: "Backend offline", className: "offline" };
    if (!connection.modelOnline) return { text: "LLM offline", className: "warning" };
    return { text: "Online", className: "online" };
  }, [connection]);

  const canSend = connection.backendOnline && connection.modelOnline && !isSending;

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

  const submit = useCallback(async () => {
    const trimmedInput = input.trim();
    if (!trimmedInput || !canSend) return;

    const userMessage: AiMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmedInput
    };
    const nextMessages = [...messages, userMessage];

    setMessages(nextMessages);
    setInput("");
    setSendingMode(
      permissionMode === "assist" && looksLikeKnowledgeNoteRequest(trimmedInput)
        ? "knowledge"
        : looksLikeActionRequest(trimmedInput) && permissionMode === "assist"
          ? "proposal"
          : "answer"
    );
    setIsSending(true);
    setError(null);

    try {
      const response = await sendAiMessage({
        settings,
        messages: nextMessages,
        notes,
        folders,
        activeNote,
        permissionMode
      });
      const parsed = parseAgentResponse(response.content, notes);

      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: parsed.content
        }
      ]);

      if (permissionMode === "assist" && parsed.actions.length > 0) {
        setPendingActions((current) => [
          ...current,
          ...parsed.actions.map((action) => ({ id: crypto.randomUUID(), action }))
        ]);
      }
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "AI request failed");
      void refreshConnection(false);
    } finally {
      setIsSending(false);
    }
  }, [activeNote, canSend, folders, input, messages, notes, permissionMode, refreshConnection, settings]);

  const applyAction = useCallback(async (pending: PendingAction) => {
    setApplyingActionId(pending.id);
    setError(null);

    try {
      const result = await onApplyAgentAction(pending.action);
      setPendingActions((current) => current.filter((candidate) => candidate.id !== pending.id));
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "✓ " + result
        }
      ]);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Akci se nepodařilo provést");
    } finally {
      setApplyingActionId(null);
    }
  }, [onApplyAgentAction]);

  const applyAllActions = useCallback(async () => {
    const queued = [...pendingActions];

    for (const pending of queued) {
      setApplyingActionId(pending.id);
      try {
        const result = await onApplyAgentAction(pending.action);
        setPendingActions((current) => current.filter((candidate) => candidate.id !== pending.id));
        setMessages((current) => [
          ...current,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: result
          }
        ]);
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "Akci se nepodařilo provést");
        break;
      } finally {
        setApplyingActionId(null);
      }
    }
  }, [onApplyAgentAction, pendingActions]);

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
            <select value={permissionMode} onChange={(event) => setPermissionMode(event.target.value as AiPermissionMode)}>
              <option value="read">READ · pouze čtení</option>
              <option value="assist">ASSIST · změny po potvrzení</option>
            </select>
          </label>

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
          <p>ASSIST nikdy neprovede změnu bez kliknutí na Použít. Mazání zatím Máša vůbec nemá k dispozici.</p>
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
          {notes.length} notes · {folders.length} folders · {permissionMode === "assist" ? "actions require approval" : "read only"}
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
                <button type="button" disabled={applyingActionId !== null} onClick={() => void applyAllActions()}>
                  Použít vše
                </button>
              )}
              <button type="button" disabled={applyingActionId !== null} onClick={() => setPendingActions([])}>
                Zahodit vše
              </button>
            </div>
          </div>

          {pendingActions.map((pending) => (
            <div className="agent-action-card" key={pending.id}>
              <span>ASSIST · čeká na potvrzení</span>
              <strong>{describeAgentAction(pending.action, notes)}</strong>
              <div>
                <button
                  type="button"
                  className="agent-apply"
                  disabled={applyingActionId !== null}
                  onClick={() => void applyAction(pending)}
                >
                  {applyingActionId === pending.id ? "Provádím…" : "Použít"}
                </button>
                <button
                  type="button"
                  disabled={applyingActionId !== null}
                  onClick={() => setPendingActions((current) => current.filter((candidate) => candidate.id !== pending.id))}
                >
                  Zahodit
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      {error && <div className="ai-error">{error}</div>}

      <div className="chat-composer">
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              void submit();
            }
          }}
          placeholder={connection.modelOnline ? "Řekni Máše, co má v Ethical World udělat…" : "AI je offline – nejdřív spusť lokální model"}
          rows={3}
        />
        <button className="primary-button" type="button" onClick={() => void submit()} disabled={!canSend}>
          {isSending ? "…" : "Send"}
        </button>
      </div>
    </aside>
  );
});

export default AiPanel;
