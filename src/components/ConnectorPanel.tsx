import { memo, useCallback, useState } from "react";
import { markdownFilesToNotes, notesToMarkdownFiles } from "../lib/markdownConnector";
import type { Note } from "../types";

interface ConnectorPanelProps {
  notes: Note[];
  onImportNotes: (notes: Note[]) => Promise<void>;
}

interface MarkdownConnection {
  id: string;
  label: string;
}

export const ConnectorPanel = memo(function ConnectorPanel({ notes, onImportNotes }: ConnectorPanelProps) {
  const [connection, setConnection] = useState<MarkdownConnection | null>(null);
  const [busy, setBusy] = useState<"connect" | "import" | "export" | null>(null);
  const [status, setStatus] = useState("Vyber lokální workspace nebo složku s Markdown soubory.");

  const connectLocal = useCallback(async () => {
    if (!window.ethicalDesktop) {
      setStatus("Lokální workspace connector je dostupný pouze v desktopové aplikaci.");
      return;
    }

    setBusy("connect");

    try {
      const selected = await window.ethicalDesktop.selectMarkdownFolder();

      if (selected) {
        setConnection(selected);
        setStatus("Připojeno: " + selected.label);
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Složku se nepodařilo připojit.");
    } finally {
      setBusy(null);
    }
  }, []);

  const importMarkdown = useCallback(async () => {
    if (!window.ethicalDesktop || !connection) return;

    setBusy("import");

    try {
      const result = await window.ethicalDesktop.readMarkdownFiles(connection.id);
      const imported = markdownFilesToNotes(result.files, connection.id, notes);
      await onImportNotes(imported);
      setStatus(
        "Importováno " + imported.length + " Markdown souborů" +
        (result.truncated ? " (dosažen bezpečnostní limit)." : ".")
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Import Markdownu selhal.");
    } finally {
      setBusy(null);
    }
  }, [connection, notes, onImportNotes]);

  const exportMarkdown = useCallback(async () => {
    if (!window.ethicalDesktop || !connection) return;

    setBusy("export");

    try {
      const files = notesToMarkdownFiles(notes, connection.id);
      const result = await window.ethicalDesktop.writeMarkdownFiles(connection.id, files);
      setStatus("Exportováno " + result.written + " Markdown souborů do " + connection.label + ".");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Export Markdownu selhal.");
    } finally {
      setBusy(null);
    }
  }, [connection, notes]);

  return (
    <main className="connector-pane">
      <header className="connector-heading">
        <div>
          <span>INTEGRATIONS</span>
          <h1>Connectors</h1>
        </div>
        <p>Synchronizuj znalosti, ne celý projekt.</p>
      </header>

      <div className="connector-grid">
        <section className="connector-card connector-card-ready">
          <div className="connector-card-head">
            <div className="connector-icon">VS</div>
            <div>
              <strong>Local / VS Code workspace</strong>
              <span>{connection ? "Připojeno · " + connection.label : "Desktop connector"}</span>
            </div>
          </div>

          <p>
            Načte pouze <code>.md</code> a <code>.mdx</code>. Zdrojové kódy, Git metadata,
            node_modules ani ostatní projektové soubory se neimportují.
          </p>

          <div className="connector-actions">
            <button type="button" onClick={() => void connectLocal()} disabled={busy !== null}>
              {busy === "connect" ? "Otevírám…" : connection ? "Změnit složku" : "Vybrat složku"}
            </button>
            <button type="button" onClick={() => void importMarkdown()} disabled={!connection || busy !== null}>
              {busy === "import" ? "Importuju…" : "Import MD"}
            </button>
            <button type="button" onClick={() => void exportMarkdown()} disabled={!connection || busy !== null}>
              {busy === "export" ? "Exportuju…" : "Export vaultu"}
            </button>
          </div>

          <small>{status}</small>
        </section>

        <section className="connector-card">
          <div className="connector-card-head">
            <div className="connector-icon">GH</div>
            <div>
              <strong>GitHub</strong>
              <span>OAuth + Markdown-only sync</span>
            </div>
          </div>
          <p>
            Adapter bude importovat a exportovat pouze Markdown přes GitHub API,
            bez klonování celého repozitáře.
          </p>
          <div className="connector-badge">OAuth credentials · další krok</div>
        </section>

        <section className="connector-card">
          <div className="connector-card-head">
            <div className="connector-icon">N</div>
            <div>
              <strong>Notion</strong>
              <span>OAuth workspace adapter</span>
            </div>
          </div>
          <p>
            Notion stránky budou mapované na Markdown poznámky se zachovaným původem
            pro pozdější obousměrnou synchronizaci.
          </p>
          <div className="connector-badge">OAuth credentials · další krok</div>
        </section>
      </div>
    </main>
  );
});

export default ConnectorPanel;
