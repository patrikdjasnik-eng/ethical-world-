import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { markdownFilesToNotes, notesToMarkdownFiles } from "../lib/markdownConnector";
import type { DesktopGitHubRepo } from "../types/desktop";
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
  const [localBusy, setLocalBusy] = useState<"connect" | "import" | "export" | null>(null);
  const [localStatus, setLocalStatus] = useState("Vyber lokální workspace nebo složku s Markdown soubory.");

  const [githubConfigured, setGithubConfigured] = useState(false);
  const [githubLogin, setGithubLogin] = useState<string | null>(null);
  const [githubRepos, setGithubRepos] = useState<DesktopGitHubRepo[]>([]);
  const [githubRepo, setGithubRepo] = useState("");
  const [githubBusy, setGithubBusy] = useState<"login" | "repos" | "import" | "export" | null>(null);
  const [githubStatusText, setGithubStatusText] = useState("Kontroluju GitHub connector…");
  const [githubUserCode, setGithubUserCode] = useState<string | null>(null);

  const selectedGitHubRepo = useMemo(
    () => githubRepos.find((repo) => repo.fullName === githubRepo) ?? null,
    [githubRepo, githubRepos]
  );

  const loadGitHubRepos = useCallback(async () => {
    if (!window.ethicalDesktop) return;
    setGithubBusy("repos");

    try {
      const repos = await window.ethicalDesktop.githubListRepos();
      setGithubRepos(repos);
      setGithubRepo((current) => current || repos[0]?.fullName || "");
      setGithubStatusText(repos.length > 0 ? "Vyber repo pro Markdown sync." : "Účet nemá dostupná repozitáře.");
    } catch (error) {
      setGithubStatusText(error instanceof Error ? error.message : "Repozitáře se nepodařilo načíst.");
    } finally {
      setGithubBusy(null);
    }
  }, []);

  useEffect(() => {
    if (!window.ethicalDesktop) {
      setGithubStatusText("GitHub connector je dostupný pouze v desktopové aplikaci.");
      return;
    }

    let cancelled = false;

    void window.ethicalDesktop.githubStatus().then((status) => {
      if (cancelled) return;
      setGithubConfigured(status.configured);
      setGithubLogin(status.connected ? status.login : null);

      if (!status.configured) {
        setGithubStatusText("Chybí ETHICAL_GITHUB_CLIENT_ID.");
      } else if (status.connected) {
        setGithubStatusText("Připojeno" + (status.login ? " jako @" + status.login : "") + ".");
        void loadGitHubRepos();
      } else {
        setGithubStatusText("GitHub je připravený k přihlášení.");
      }
    }).catch(() => {
      if (!cancelled) setGithubStatusText("GitHub connector se nepodařilo inicializovat.");
    });

    return () => {
      cancelled = true;
    };
  }, [loadGitHubRepos]);

  const connectLocal = useCallback(async () => {
    if (!window.ethicalDesktop) {
      setLocalStatus("Lokální workspace connector je dostupný pouze v desktopové aplikaci.");
      return;
    }

    setLocalBusy("connect");

    try {
      const selected = await window.ethicalDesktop.selectMarkdownFolder();

      if (selected) {
        setConnection(selected);
        setLocalStatus("Připojeno: " + selected.label);
      }
    } catch (error) {
      setLocalStatus(error instanceof Error ? error.message : "Složku se nepodařilo připojit.");
    } finally {
      setLocalBusy(null);
    }
  }, []);

  const importLocalMarkdown = useCallback(async () => {
    if (!window.ethicalDesktop || !connection) return;
    setLocalBusy("import");

    try {
      const result = await window.ethicalDesktop.readMarkdownFiles(connection.id);
      const imported = markdownFilesToNotes(result.files, connection.id, notes, "local-markdown");
      await onImportNotes(imported);
      setLocalStatus(
        "Importováno " + imported.length + " Markdown souborů" +
        (result.truncated ? " (dosažen bezpečnostní limit)." : ".")
      );
    } catch (error) {
      setLocalStatus(error instanceof Error ? error.message : "Import Markdownu selhal.");
    } finally {
      setLocalBusy(null);
    }
  }, [connection, notes, onImportNotes]);

  const exportLocalMarkdown = useCallback(async () => {
    if (!window.ethicalDesktop || !connection) return;
    setLocalBusy("export");

    try {
      const files = notesToMarkdownFiles(notes, connection.id, "local-markdown");
      const result = await window.ethicalDesktop.writeMarkdownFiles(connection.id, files);
      setLocalStatus("Exportováno " + result.written + " Markdown souborů do " + connection.label + ".");
    } catch (error) {
      setLocalStatus(error instanceof Error ? error.message : "Export Markdownu selhal.");
    } finally {
      setLocalBusy(null);
    }
  }, [connection, notes]);

  const connectGitHub = useCallback(async () => {
    if (!window.ethicalDesktop) return;
    setGithubBusy("login");
    setGithubUserCode(null);

    try {
      const started = await window.ethicalDesktop.githubStartLogin();

      if (!started.configured || !started.sessionId) {
        setGithubConfigured(false);
        setGithubStatusText("Nejdřív nastav ETHICAL_GITHUB_CLIENT_ID a restartuj desktop dev.");
        return;
      }

      setGithubConfigured(true);
      setGithubUserCode(started.userCode ?? null);
      setGithubStatusText(
        "GitHub se otevřel v prohlížeči. Zadej kód " + (started.userCode ?? "") + "."
      );

      let intervalSeconds = Math.max(started.intervalSeconds ?? 5, 5);
      const expiresAt = started.expiresAt ?? Date.now() + 15 * 60 * 1000;

      while (Date.now() < expiresAt) {
        await new Promise((resolve) => window.setTimeout(resolve, intervalSeconds * 1000));
        const result = await window.ethicalDesktop.githubPollLogin(started.sessionId);

        if (result.status === "pending") {
          intervalSeconds = Math.max(result.intervalSeconds ?? intervalSeconds, intervalSeconds);
          continue;
        }

        if (result.status === "connected") {
          setGithubLogin(result.login);
          setGithubUserCode(null);
          setGithubStatusText("Připojeno" + (result.login ? " jako @" + result.login : "") + ".");
          await loadGitHubRepos();
          return;
        }

        if (result.status === "error") {
          setGithubStatusText(result.error ?? "GitHub autorizace selhala.");
          return;
        }

        setGithubStatusText("GitHub autorizační kód vypršel. Spusť přihlášení znovu.");
        return;
      }
    } catch (error) {
      setGithubStatusText(error instanceof Error ? error.message : "GitHub přihlášení selhalo.");
    } finally {
      setGithubBusy(null);
    }
  }, [loadGitHubRepos]);

  const disconnectGitHub = useCallback(async () => {
    if (!window.ethicalDesktop) return;
    await window.ethicalDesktop.githubDisconnect();
    setGithubLogin(null);
    setGithubRepos([]);
    setGithubRepo("");
    setGithubUserCode(null);
    setGithubStatusText("GitHub byl odpojen.");
  }, []);

  const importGitHubMarkdown = useCallback(async () => {
    if (!window.ethicalDesktop || !selectedGitHubRepo) return;
    setGithubBusy("import");

    try {
      const result = await window.ethicalDesktop.githubReadMarkdown(
        selectedGitHubRepo.fullName,
        selectedGitHubRepo.defaultBranch
      );
      const imported = markdownFilesToNotes(result.files, result.connectionId, notes, "github");
      await onImportNotes(imported);
      setGithubStatusText(
        "Importováno " + imported.length + " Markdown souborů z " + result.repoFullName + "/" + result.branch +
        (result.truncated ? " (výsledek byl omezen)." : ".")
      );
    } catch (error) {
      setGithubStatusText(error instanceof Error ? error.message : "GitHub import selhal.");
    } finally {
      setGithubBusy(null);
    }
  }, [notes, onImportNotes, selectedGitHubRepo]);

  const exportGitHubMarkdown = useCallback(async () => {
    if (!window.ethicalDesktop || !selectedGitHubRepo) return;
    setGithubBusy("export");

    try {
      const connectionId = "github:" + selectedGitHubRepo.fullName + ":" + selectedGitHubRepo.defaultBranch;
      const files = notesToMarkdownFiles(notes, connectionId, "github");
      const result = await window.ethicalDesktop.githubWriteMarkdown(
        selectedGitHubRepo.fullName,
        selectedGitHubRepo.defaultBranch,
        files
      );
      setGithubStatusText(
        "Zapsáno " + result.written + " Markdown souborů. Commit " + result.commitSha.slice(0, 8) + "."
      );
    } catch (error) {
      setGithubStatusText(error instanceof Error ? error.message : "GitHub export selhal.");
    } finally {
      setGithubBusy(null);
    }
  }, [notes, selectedGitHubRepo]);

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
            <button type="button" onClick={() => void connectLocal()} disabled={localBusy !== null}>
              {localBusy === "connect" ? "Otevírám…" : connection ? "Změnit složku" : "Vybrat složku"}
            </button>
            <button type="button" onClick={() => void importLocalMarkdown()} disabled={!connection || localBusy !== null}>
              {localBusy === "import" ? "Importuju…" : "Import MD"}
            </button>
            <button type="button" onClick={() => void exportLocalMarkdown()} disabled={!connection || localBusy !== null}>
              {localBusy === "export" ? "Exportuju…" : "Export vaultu"}
            </button>
          </div>

          <small>{localStatus}</small>
        </section>

        <section className={"connector-card " + (githubLogin ? "connector-card-ready" : "")}>
          <div className="connector-card-head">
            <div className="connector-icon">GH</div>
            <div>
              <strong>GitHub</strong>
              <span>{githubLogin ? "Připojeno · @" + githubLogin : "Device OAuth · Markdown-only sync"}</span>
            </div>
          </div>

          <p>
            Repo se neklonuje. Ethical World čte a zapisuje pouze <code>.md</code>/<code>.mdx</code>
            přes GitHub API. Přístupový token je uložený přes OS secure storage.
          </p>

          {!githubLogin ? (
            <div className="connector-actions">
              <button type="button" onClick={() => void connectGitHub()} disabled={!githubConfigured || githubBusy !== null}>
                {githubBusy === "login" ? "Čekám na GitHub…" : "Připojit GitHub"}
              </button>
              {githubUserCode && <code className="connector-code">{githubUserCode}</code>}
            </div>
          ) : (
            <>
              <label className="connector-select">
                Repository
                <select value={githubRepo} onChange={(event) => setGithubRepo(event.target.value)}>
                  {githubRepos.map((repo) => (
                    <option key={repo.fullName} value={repo.fullName}>
                      {repo.fullName}{repo.private ? " · private" : ""}
                    </option>
                  ))}
                </select>
              </label>

              <div className="connector-actions">
                <button type="button" onClick={() => void importGitHubMarkdown()} disabled={!selectedGitHubRepo || githubBusy !== null}>
                  {githubBusy === "import" ? "Importuju…" : "Import MD"}
                </button>
                <button
                  type="button"
                  onClick={() => void exportGitHubMarkdown()}
                  disabled={!selectedGitHubRepo?.canPush || githubBusy !== null}
                  title={selectedGitHubRepo?.canPush ? "Export do repozitáře" : "Pro toto repo nemáš write oprávnění"}
                >
                  {githubBusy === "export" ? "Exportuju…" : "Export vaultu"}
                </button>
                <button type="button" onClick={() => void disconnectGitHub()} disabled={githubBusy !== null}>
                  Odpojit
                </button>
              </div>
            </>
          )}

          <small>{githubStatusText}</small>
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
          <div className="connector-badge">OAuth backend · připravuje se</div>
        </section>
      </div>
    </main>
  );
});

export default ConnectorPanel;
