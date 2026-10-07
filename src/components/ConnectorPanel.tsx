import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { markdownFilesToNotes, notesToMarkdownFiles } from "../lib/markdownConnector";
import {
  disconnectNotion,
  getNotionStatus,
  listNotionPages,
  readNotionMarkdown,
  startNotionLogin,
  writeNotionMarkdown,
  type NotionPageSummary
} from "../lib/notionConnector";
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

function waitForLoginPoll(signal: AbortSignal, milliseconds: number): Promise<boolean> {
  if (signal.aborted) return Promise.resolve(false);
  return new Promise((resolve) => {
    const finish = (elapsed: boolean) => {
      window.clearTimeout(timer);
      signal.removeEventListener("abort", cancel);
      resolve(elapsed);
    };
    const cancel = () => finish(false);
    const timer = window.setTimeout(() => finish(true), milliseconds);
    signal.addEventListener("abort", cancel, { once: true });
  });
}

export const ConnectorPanel = memo(function ConnectorPanel({ notes, onImportNotes }: ConnectorPanelProps) {
  const [exportAll, setExportAll] = useState(false);
  const selectExportNotes = useCallback((connectionId: string, provider: "local-markdown" | "github") => {
    return exportAll ? notes : notes.filter((note) => note.source?.provider === provider && note.source.connectionId === connectionId);
  }, [exportAll, notes]);
  const confirmExport = useCallback((files: { relativePath: string }[], destination: string) => {
    if (files.length === 0) throw new Error("Není vybraná žádná poznámka. Pro nové poznámky zapni export celého vaultu.");
    return window.confirm("Export " + files.length + " poznámek do " + destination + "\n\n" + files.slice(0, 15).map((file) => file.relativePath).join("\n") + (files.length > 15 ? "\n…" : ""));
  }, []);
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
  const [githubScope, setGithubScope] = useState<"public_repo" | "repo">("public_repo");
  const githubAttempt = useRef<{ controller: AbortController; sessionId?: string } | null>(null);
  const cancelGitHubLogin = useCallback((showStatus = true) => {
    const attempt = githubAttempt.current;
    if (!attempt) return;
    githubAttempt.current = null;
    attempt.controller.abort();
    void window.ethicalDesktop?.githubCancelLogin(attempt.sessionId).catch(() => undefined);
    if (showStatus) {
      setGithubBusy(null);
      setGithubUserCode(null);
      setGithubStatusText("GitHub přihlášení zrušeno.");
    }
  }, []);
  useEffect(() => () => cancelGitHubLogin(false), [cancelGitHubLogin]);

  const [notionConfigured, setNotionConfigured] = useState(false);
  const [notionConnected, setNotionConnected] = useState(false);
  const [notionWorkspace, setNotionWorkspace] = useState<string | null>(null);
  const [notionPages, setNotionPages] = useState<NotionPageSummary[]>([]);
  const [notionPageId, setNotionPageId] = useState("");
  const [notionBusy, setNotionBusy] = useState<"login" | "pages" | "import" | "export" | null>(null);
  const [notionStatusText, setNotionStatusText] = useState("Kontroluju Notion connector…");

  const selectedGitHubRepo = useMemo(
    () => githubRepos.find((repo) => repo.fullName === githubRepo) ?? null,
    [githubRepo, githubRepos]
  );

  const selectedNotionPage = useMemo(
    () => notionPages.find((page) => page.id === notionPageId) ?? null,
    [notionPageId, notionPages]
  );

  const mappedNotionNote = useMemo(
    () => notes.find(
      (note) =>
        note.source?.provider === "notion" &&
        note.source.connectionId === (notionPageId ? "notion:" + notionPageId : "")
    ) ?? null,
    [notionPageId, notes]
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

      if (status.connected) {
        setGithubStatusText("Připojeno" + (status.login ? " jako @" + status.login : "") + ".");
        void loadGitHubRepos();
      } else if (!status.configured) {
        setGithubStatusText("Device OAuth není nakonfigurovaný. GitHub lze připojit tokenem.");
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

  const refreshNotion = useCallback(async (loadPages = true) => {
    try {
      const status = await getNotionStatus();
      setNotionConfigured(status.configured);
      setNotionConnected(status.connected);
      setNotionWorkspace(status.workspaceName);

      if (!status.configured) {
        setNotionStatusText("Chybí Notion OAuth konfigurace na backendu.");
        setNotionPages([]);
        setNotionPageId("");
        return false;
      }

      if (!status.connected) {
        setNotionStatusText("Notion je připravený k připojení.");
        setNotionPages([]);
        setNotionPageId("");
        return false;
      }

      setNotionStatusText(
        "Připojeno" + (status.workspaceName ? " · " + status.workspaceName : "") + "."
      );

      if (loadPages) {
        setNotionBusy("pages");
        const pages = await listNotionPages();
        setNotionPages(pages);
        setNotionPageId((current) => current || pages[0]?.id || "");
      }

      return true;
    } catch (error) {
      setNotionStatusText(error instanceof Error ? error.message : "Notion connector není dostupný.");
      return false;
    } finally {
      setNotionBusy(null);
    }
  }, []);

  useEffect(() => {
    void refreshNotion(true);
  }, [refreshNotion]);

  const connectNotion = useCallback(async () => {
    setNotionBusy("login");

    try {
      const authorizationUrl = await startNotionLogin();
      window.open(authorizationUrl, "_blank", "noopener,noreferrer");
      setNotionStatusText("Dokonči autorizaci v prohlížeči…");

      const deadline = Date.now() + 2 * 60 * 1000;
      while (Date.now() < deadline) {
        await new Promise((resolve) => window.setTimeout(resolve, 2500));
        const connected = await refreshNotion(false);
        if (connected) {
          await refreshNotion(true);
          return;
        }
      }

      setNotionStatusText("Autorizace stále čeká. Po dokončení klikni na Zkontrolovat.");
    } catch (error) {
      setNotionStatusText(error instanceof Error ? error.message : "Notion přihlášení selhalo.");
    } finally {
      setNotionBusy(null);
    }
  }, [refreshNotion]);

  const disconnectNotionAccount = useCallback(async () => {
    try {
      await disconnectNotion();
      setNotionConnected(false);
      setNotionWorkspace(null);
      setNotionPages([]);
      setNotionPageId("");
      setNotionStatusText("Notion byl odpojen.");
    } catch (error) {
      setNotionStatusText(error instanceof Error ? error.message : "Notion odpojení selhalo.");
    }
  }, []);

  const importNotionPage = useCallback(async () => {
    if (!selectedNotionPage) return;
    setNotionBusy("import");

    try {
      const result = await readNotionMarkdown(selectedNotionPage.id);
      const connectionId = "notion:" + result.pageId;
      const imported = markdownFilesToNotes(
        [{
          relativePath: (result.title || "Notion page").replace(/[\\/:*?"<>|]/g, " ") + ".md",
          content: result.markdown
        }],
        connectionId,
        notes,
        "notion"
      );
      await onImportNotes(imported);
      setNotionStatusText(
        "Importována stránka „" + result.title + "“" +
        (result.truncated ? " (Notion označil výstup jako zkrácený)." : ".")
      );
    } catch (error) {
      setNotionStatusText(error instanceof Error ? error.message : "Notion import selhal.");
    } finally {
      setNotionBusy(null);
    }
  }, [notes, onImportNotes, selectedNotionPage]);

  const exportNotionPage = useCallback(async () => {
    if (!selectedNotionPage || !mappedNotionNote) return;
    setNotionBusy("export");

    try {
      await writeNotionMarkdown(selectedNotionPage.id, mappedNotionNote.content);
      setNotionStatusText("Aktualizována Notion stránka „" + selectedNotionPage.title + "“.");
    } catch (error) {
      setNotionStatusText(error instanceof Error ? error.message : "Notion export selhal.");
    } finally {
      setNotionBusy(null);
    }
  }, [mappedNotionNote, selectedNotionPage]);

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
      const files = notesToMarkdownFiles(selectExportNotes(connection.id, "local-markdown"), connection.id, "local-markdown");
      if (!confirmExport(files, connection.label)) return;
      const result = await window.ethicalDesktop.writeMarkdownFiles(connection.id, files);
      setLocalStatus("Exportováno " + result.written + " Markdown souborů do " + connection.label + ".");
    } catch (error) {
      setLocalStatus(error instanceof Error ? error.message : "Export Markdownu selhal.");
    } finally {
      setLocalBusy(null);
    }
  }, [connection, selectExportNotes, confirmExport]);

  const connectGitHubToken = useCallback(async () => {
    const desktop = window.ethicalDesktop;
    if (!desktop || githubAttempt.current) return;
    const attempt = { controller: new AbortController() };
    githubAttempt.current = attempt;
    setGithubBusy("login");
    setGithubUserCode(null);
    try {
      const connected = await desktop.githubConnectToken();
      if (attempt.controller.signal.aborted) return;
      if (connected.error) { setGithubStatusText(connected.error); return; }
      if (!connected.connected) { setGithubStatusText("Připojení tokenem zrušeno."); return; }
      setGithubLogin(connected.login);
      setGithubStatusText("GitHub připojený přes OS secure storage.");
      await loadGitHubRepos();
    } catch (error) {
      if (!attempt.controller.signal.aborted) setGithubStatusText(error instanceof Error ? error.message : "GitHub přihlášení tokenem selhalo.");
    } finally {
      if (githubAttempt.current === attempt) {
        githubAttempt.current = null;
        setGithubBusy(null);
      }
    }
  }, [loadGitHubRepos]);

  const connectGitHub = useCallback(async () => {
    const desktop = window.ethicalDesktop;
    if (!desktop || githubAttempt.current) return;
    const attempt: { controller: AbortController; sessionId?: string } = { controller: new AbortController() };
    githubAttempt.current = attempt;
    setGithubBusy("login");
    setGithubUserCode(null);
    try {
      const started = await desktop.githubStartLogin(githubScope);
      if (attempt.controller.signal.aborted) return;
      if (started.cancelled) { setGithubStatusText("GitHub přihlášení zrušeno."); return; }
      if (started.error) { setGithubStatusText(started.error); return; }
      if (!started.configured || !started.sessionId) {
        setGithubConfigured(false);
        setGithubStatusText("Device OAuth není nakonfigurovaný. GitHub lze připojit tokenem.");
        return;
      }
      attempt.sessionId = started.sessionId;
      setGithubUserCode(started.userCode ?? null);
      setGithubStatusText("Na github.com/login/device zadej pouze kód z tohoto okna. Kódy z cizích zpráv nepoužívej.");
      let intervalSeconds = Math.max(started.intervalSeconds ?? 5, 5);
      const expiresAt = started.expiresAt ?? Date.now() + 15 * 60 * 1000;
      while (Date.now() < expiresAt) {
        if (!await waitForLoginPoll(attempt.controller.signal, intervalSeconds * 1000)) return;
        if (Date.now() >= expiresAt) break;
        const result = await desktop.githubPollLogin(started.sessionId);
        if (attempt.controller.signal.aborted) return;
        if (result.status === "pending") {
          intervalSeconds = Math.max(result.intervalSeconds ?? intervalSeconds, intervalSeconds);
          continue;
        }
        if (result.status === "connected") {
          setGithubLogin(result.login);
          setGithubStatusText("Připojeno" + (result.login ? " jako @" + result.login : "") + ".");
          await loadGitHubRepos();
          return;
        }
        if (result.status === "error") { setGithubStatusText(result.error ?? "GitHub autorizace selhala."); return; }
        if (result.status === "cancelled") { setGithubStatusText("GitHub přihlášení zrušeno."); return; }
        break;
      }
      setGithubStatusText("GitHub autorizační kód vypršel. Spusť přihlášení znovu.");
    } catch (error) {
      if (!attempt.controller.signal.aborted) setGithubStatusText(error instanceof Error ? error.message : "GitHub přihlášení selhalo.");
    } finally {
      if (githubAttempt.current === attempt) {
        githubAttempt.current = null;
        setGithubUserCode(null);
        setGithubBusy(null);
        void desktop.githubCancelLogin(attempt.sessionId).catch(() => undefined);
      }
    }
  }, [githubScope, loadGitHubRepos]);

  const disconnectGitHub = useCallback(async () => {
    if (!window.ethicalDesktop) return;
    try {
      await window.ethicalDesktop.githubDisconnect();
    } catch (error) {
      setGithubStatusText(String(error));
      return;
    }
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
      const files = notesToMarkdownFiles(selectExportNotes(connectionId, "github"), connectionId, "github");
      if (!confirmExport(files, selectedGitHubRepo.fullName + (selectedGitHubRepo.private ? " · private" : " · PUBLIC — poznámky budou veřejné"))) return;
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
  }, [selectExportNotes, confirmExport, selectedGitHubRepo]);

  return (
    <main className="connector-pane">
      <header className="connector-heading">
        <div>
          <span>INTEGRATIONS</span>
          <h1>Connectors</h1>
        </div>
        <p>Synchronizuj znalosti, ne celý projekt.</p>
      </header>

      <label className="connector-export-scope">
        <input type="checkbox" checked={exportAll} onChange={(event) => setExportAll(event.target.checked)} />
        Exportovat celý vault včetně poznámek z jiných zdrojů
      </label>
      <p>Výchozí export zahrnuje pouze poznámky importované z vybraného zdroje. Před zápisem uvidíš cíl a soubory.</p>
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
              {localBusy === "export" ? "Exportuju…" : "Export poznámek"}
            </button>
          </div>

          <small>{localStatus}</small>
        </section>

        <section className={"connector-card " + (githubLogin ? "connector-card-ready" : "")}>
          <div className="connector-card-head">
            <div className="connector-icon">GH</div>
            <div>
              <strong>GitHub</strong>
              <span>{githubLogin ? "Připojeno · @" + githubLogin : "Device OAuth / token · Markdown-only sync"}</span>
            </div>
          </div>

          <p>
            Repo se neklonuje. Ethical World čte a zapisuje pouze <code>.md</code>/<code>.mdx</code>
            přes GitHub API. Přístupový token je uložený přes OS secure storage.
          </p>

          {!githubLogin ? (
            <div className="connector-actions">
              <label className="connector-select">
                Přístup přes GitHub OAuth
                <select value={githubScope} onChange={(event) => setGithubScope(event.target.value as "public_repo" | "repo")} disabled={githubBusy !== null}>
                  <option value="public_repo">Veřejné repozitáře</option>
                  <option value="repo">Veřejné a soukromé repozitáře</option>
                </select>
              </label>
              {githubScope === "repo" && <small>Soukromé repozitáře vyžadují širší oprávnění. Pro přístup jen k vybraným repozitářům použij fine-grained token.</small>}
              <button type="button" onClick={() => void connectGitHub()} disabled={!githubConfigured || githubBusy !== null}>
                {githubBusy === "login" ? "Čekám na GitHub…" : "Připojit GitHub"}
              </button>
              <button type="button" onClick={() => void connectGitHubToken()} disabled={githubBusy !== null}>
                Připojit tokenem
              </button>
              {githubBusy === "login" && <button type="button" onClick={() => cancelGitHubLogin()}>Zrušit přihlášení</button>}
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
                  {githubBusy === "export" ? "Exportuju…" : "Export poznámek"}
                </button>
                <button type="button" onClick={() => void disconnectGitHub()} disabled={githubBusy !== null}>
                  Odpojit
                </button>
              </div>
            </>
          )}

          <small>{githubStatusText}</small>
        </section>

        <section className={"connector-card " + (notionConnected ? "connector-card-ready" : "")}>
          <div className="connector-card-head">
            <div className="connector-icon">N</div>
            <div>
              <strong>Notion</strong>
              <span>
                {notionConnected
                  ? "Připojeno" + (notionWorkspace ? " · " + notionWorkspace : "")
                  : "OAuth · enhanced Markdown sync"}
              </span>
            </div>
          </div>

          <p>
            Ethical World načte vybranou Notion stránku jako Markdown note a umí obsah
            zapsat zpět přes Notion Markdown API. Token zůstává šifrovaný v backend DB.
          </p>

          {!notionConnected ? (
            <div className="connector-actions">
              <button
                type="button"
                onClick={() => void connectNotion()}
                disabled={!notionConfigured || notionBusy !== null}
              >
                {notionBusy === "login" ? "Čekám na Notion…" : "Připojit Notion"}
              </button>
              <button
                type="button"
                onClick={() => void refreshNotion(true)}
                disabled={notionBusy !== null}
              >
                Zkontrolovat
              </button>
            </div>
          ) : (
            <>
              <label className="connector-select">
                Page
                <select value={notionPageId} onChange={(event) => setNotionPageId(event.target.value)}>
                  {notionPages.map((page) => (
                    <option key={page.id} value={page.id}>{page.title}</option>
                  ))}
                </select>
              </label>

              <div className="connector-actions">
                <button
                  type="button"
                  onClick={() => void importNotionPage()}
                  disabled={!selectedNotionPage || notionBusy !== null}
                >
                  {notionBusy === "import" ? "Importuju…" : "Import page"}
                </button>
                <button
                  type="button"
                  onClick={() => void exportNotionPage()}
                  disabled={!mappedNotionNote || notionBusy !== null}
                  title={mappedNotionNote ? "Zapsat importovanou note zpět do Notion" : "Nejdřív stránku importuj"}
                >
                  {notionBusy === "export" ? "Exportuju…" : "Export zpět"}
                </button>
                <button
                  type="button"
                  onClick={() => void disconnectNotionAccount()}
                  disabled={notionBusy !== null}
                >
                  Odpojit
                </button>
              </div>
            </>
          )}

          <small>{notionStatusText}</small>
        </section>
      </div>
    </main>
  );
});

export default ConnectorPanel;
