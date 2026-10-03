import { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  autoDetectLocalProvider,
  checkGatewayHealth,
  checkProviderStatus,
  sendAiMessage
} from "../lib/ai";
import type { AiMessage, AiProvider, AiSettings, Note } from "../types";

interface AiPanelProps {
  activeNote: Note | null;
  notes: Note[];
}

interface ConnectionState {
  backendOnline: boolean;
  modelOnline: boolean;
  checking: boolean;
}

const initialMessage: AiMessage = {
  id: "welcome",
  role: "assistant",
  content: "Jsem Máša. Jakmile najdu lokální model, můžu pracovat s kontextem otevřené poznámky a vaultu."
};

export const AiPanel = memo(function AiPanel({ activeNote, notes }: AiPanelProps) {
  const [messages, setMessages] = useState<AiMessage[]>([initialMessage]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [connection, setConnection] = useState<ConnectionState>({
    backendOnline: false,
    modelOnline: false,
    checking: true
  });
  const [settings, setSettings] = useState<AiSettings>({
    provider: "ollama",
    model: "qwen2.5:7b",
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
        const detectedModel = detected.model;

        setSettings((current) => ({
          ...current,
          provider: detected.provider,
          baseUrl: detected.baseUrl,
          model: detectedModel
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
      model: provider === "ollama" ? "qwen2.5:7b" : "local-model"
    }));
  }, []);

  const status = useMemo(() => {
    if (connection.checking) {
      return { text: "Kontroluju…", className: "checking" };
    }

    if (!connection.backendOnline) {
      return { text: "Backend offline", className: "offline" };
    }

    if (!connection.modelOnline) {
      return { text: "LLM offline", className: "warning" };
    }

    return { text: "Online", className: "online" };
  }, [connection]);

  const canSend = connection.backendOnline && connection.modelOnline && !isSending;

  const submit = useCallback(async () => {
    const trimmedInput = input.trim();

    if (!trimmedInput || !canSend) {
      return;
    }

    const userMessage: AiMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmedInput
    };
    const nextMessages = [...messages, userMessage];

    setMessages(nextMessages);
    setInput("");
    setIsSending(true);
    setError(null);

    try {
      const response = await sendAiMessage({ settings, messages: nextMessages, notes, activeNote });

      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: response.content
        }
      ]);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "AI request failed");
      void refreshConnection(false);
    } finally {
      setIsSending(false);
    }
  }, [activeNote, canSend, input, messages, notes, refreshConnection, settings]);

  return (
    <aside className="ai-panel"><div className="pane-titlebar"><span>Assistant</span><span className="pane-actions">− □</span></div>
      <div className="ai-header"><div className="ai-avatar">M</div>
        <div>
          <span className={`ai-status-dot ${status.className}`} />
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
          <p>API key se v této verzi neukládá do persistentního storage.</p>
        </div>
      )}

      {!connection.modelOnline && !connection.checking && (
        <div className="ai-offline-banner">
          <strong>Máša čeká na model.</strong>
          <span>
            {connection.backendOnline
              ? "Spusť Ollamu nebo llama-server. Ethical World je automaticky zkusí najít."
              : "Spusť FastAPI backend na portu 8787."}
          </span>
          <button type="button" onClick={() => void refreshConnection(true)}>Zkontrolovat znovu</button>
        </div>
      )}

      <div className="ai-context">
        <span>Context</span>
        <strong>{activeNote?.title ?? "žádná poznámka"}</strong>
        <small>{notes.length} notes available</small>
      </div>

      <div className="message-list">
        {messages.map((message) => (
          <div className={`message ${message.role}`} key={message.id}>
            <span>{message.role === "assistant" ? "Máša" : "Ty"}</span>
            <p>{message.content}</p>
          </div>
        ))}
        {isSending && <div className="message assistant"><span>Máša</span><p>Pracuju s vaultem…</p></div>}
      </div>

      {error && <div className="ai-error">{error}</div>}

      <div className="chat-composer">
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void submit();
            }
          }}
          placeholder={connection.modelOnline ? "Zeptej se nad vaultem…" : "AI je offline – nejdřív spusť lokální model"}
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
