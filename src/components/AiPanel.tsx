import { memo, useCallback, useState } from "react";
import { sendAiMessage } from "../lib/ai";
import type { AiMessage, AiProvider, AiSettings, Note } from "../types";

interface AiPanelProps {
  activeNote: Note | null;
  notes: Note[];
}

const initialMessage: AiMessage = {
  id: "welcome",
  role: "assistant",
  content: "Jsem Máša. Můžu pracovat s kontextem otevřené poznámky a tvého lokálního vaultu."
};

export const AiPanel = memo(function AiPanel({ activeNote, notes }: AiPanelProps) {
  const [messages, setMessages] = useState<AiMessage[]>([initialMessage]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<AiSettings>({
    provider: "ollama",
    model: "qwen2.5:7b",
    baseUrl: "http://localhost:11434",
    apiKey: ""
  });

  const updateProvider = useCallback((provider: AiProvider) => {
    setSettings((current) => ({
      ...current,
      provider,
      baseUrl: provider === "ollama" ? "http://localhost:11434" : "http://localhost:8080/v1",
      model: provider === "ollama" ? "qwen2.5:7b" : "local-model"
    }));
  }, []);

  const submit = useCallback(async () => {
    const trimmedInput = input.trim();

    if (!trimmedInput || isSending) {
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
        { id: crypto.randomUUID(), role: "assistant", content: response.content }
      ]);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "AI request failed");
    } finally {
      setIsSending(false);
    }
  }, [activeNote, input, isSending, messages, notes, settings]);

  return (
    <aside className="ai-panel">
      <div className="ai-header">
        <div><span className="ai-status-dot" /><strong>Máša</strong><small>{settings.model}</small></div>
        <button className="icon-button" type="button" onClick={() => setShowSettings((value) => !value)} title="AI nastavení">⚙</button>
      </div>

      {showSettings && (
        <div className="ai-settings">
          <label>Provider
            <select value={settings.provider} onChange={(event) => updateProvider(event.target.value as AiProvider)}>
              <option value="ollama">Ollama</option>
              <option value="openai-compatible">OpenAI-compatible</option>
            </select>
          </label>
          <label>Model<input value={settings.model} onChange={(event) => setSettings((current) => ({ ...current, model: event.target.value }))} /></label>
          <label>Base URL<input value={settings.baseUrl} onChange={(event) => setSettings((current) => ({ ...current, baseUrl: event.target.value }))} /></label>
          {settings.provider === "openai-compatible" && (
            <label>API key
              <input type="password" value={settings.apiKey} onChange={(event) => setSettings((current) => ({ ...current, apiKey: event.target.value }))} placeholder="volitelné pro lokální server" autoComplete="off" />
            </label>
          )}
          <p>API key se v této verzi neukládá do persistentního storage.</p>
        </div>
      )}

      <div className="ai-context"><span>Context</span><strong>{activeNote?.title ?? "žádná poznámka"}</strong><small>{notes.length} notes available</small></div>

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
          onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void submit(); } }}
          placeholder="Zeptej se nad vaultem…"
          rows={3}
        />
        <button className="primary-button" type="button" onClick={() => void submit()} disabled={isSending}>{isSending ? "…" : "Send"}</button>
      </div>
    </aside>
  );
});

export default AiPanel;
