import { changedNote } from "./lib/vaultTools";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityRail } from "./components/ActivityRail";
import { MasaPet } from "./components/MasaPet";
import type { MasaPetState } from "./lib/masaPet";
import { EditorPane } from "./components/EditorPane";
import { VaultSidebar, type WorkspaceView } from "./components/VaultSidebar";
import {
  inferFoldersFromNotes,
  isPathInsideFolder,
  normalizeFolderPath,
  joinFolderPath,
  renameFolderPath,
  sanitizeFolderName
} from "./lib/folders";
import { NoteWriteQueue } from "./lib/notePersistence";
import { createEmptyNote } from "./lib/notes";
import { createCarrotCommit } from "./lib/carrot";
import { loadAiSettings } from "./lib/aiSettings";
import { initialiseAccount } from "./lib/auth";
import {
  listFolders,
  listNotes,
  removeFolder,
  removeNote,
  saveFolder,
  saveFolders,
  saveNote,
  saveNotes,
  saveWorkspace
} from "./lib/storage";
import { saveImportedWorkspace } from "./lib/storage";
import type { ExportReceipt } from "./lib/markdownConnector";
import type { AgentAction, Note, UserProfile, VaultFolder } from "./types";

const AiPanel = lazy(() => import("./components/AiPanel"));
const GraphPane = lazy(() => import("./components/GraphPane"));
const ConnectorPanel = lazy(() => import("./components/ConnectorPanel"));
const AccountPanel = lazy(() => import("./components/AccountPanel"));
const GuidePanel = lazy(() => import("./components/GuidePanel"));
const now = new Date().toISOString();

const welcomeNote: Note = {
  id: "welcome-note",
  title: "Vítej v Ethical World",
  content: "# Vítej v Ethical World\n\nToto je první lokální vault.\n\nZkus vytvořit druhou poznámku a propojit ji syntaxí `[[Vítej v Ethical World]]`.\n\nAI panel vpravo může pracovat s kontextem poznámek, které má aplikace právě ve vaultu.",
  folder: "Getting Started",
  createdAt: now,
  updatedAt: now
};

export default function App() {
  const [notes, reactSetNotes] = useState<Note[]>([]);
  const [folders, reactSetFolders] = useState<VaultFolder[]>([]);
  const notesRef = useRef<Note[]>([]);
  const foldersRef = useRef<VaultFolder[]>([]);
  const setNotes = useCallback((next: Note[] | ((current: Note[]) => Note[])) => {
    notesRef.current = typeof next === "function" ? next(notesRef.current) : next;
    reactSetNotes(notesRef.current);
  }, []);
  const setFolders = useCallback((next: VaultFolder[] | ((current: VaultFolder[]) => VaultFolder[])) => {
    foldersRef.current = typeof next === "function" ? next(foldersRef.current) : next;
    reactSetFolders(foldersRef.current);
  }, []);
  const persistence = useRef(new NoteWriteQueue(saveNote));
  const [saveStates, setSaveStates] = useState<Record<string, string>>({});
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [vaultLoadFailed, setVaultLoadFailed] = useState(false);
  const persistNote = useCallback((note: Note) => {
    setSaveStates((current) => ({ ...current, [note.id]: "ukládám…" }));
    return persistence.current.enqueue(note).then(() => {
      if (notesRef.current.find((item) => item.id === note.id)?.updatedAt === note.updatedAt) {
        setSaveStates((current) => ({ ...current, [note.id]: "uloženo" }));
      }
    }).catch((error: unknown) => {
      setSaveStates((current) => ({ ...current, [note.id]: "chyba uložení" }));
      setWorkspaceError(error instanceof Error ? error.message : "Poznámku se nepodařilo uložit.");
    });
  }, []);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [selectedFolderPath, setSelectedFolderPath] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<WorkspaceView>("note");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiLoaded, setAiLoaded] = useState(false);
  const [petState, setPetState] = useState<MasaPetState>("idle");
  const [petVisible, setPetVisible] = useState(() => {
    try { return localStorage.getItem("ethical-world-masa-pet-v1") !== "hidden"; }
    catch { return true; }
  });
  const [accountLocked, setAccountLocked] = useState(true);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [folderCreateNonce, setFolderCreateNonce] = useState(0);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const initialiseIdentity = async () => {
      const profile = await initialiseAccount();

      if (cancelled) return;
      setAccountLocked(Boolean(profile?.mustChangePassword));
      setCurrentUser(profile);

      if (profile?.mustChangePassword) {
        setAccountLocked(true);
        setSidebarOpen(false);
        setAiOpen(false);
        setView("account");
      }
    };

    void initialiseIdentity().catch((error) => {
      if (!cancelled) {
        setAccountLocked(false);
        setWorkspaceError("Účet je offline. Lokální vault je společný pro tento profil zařízení.");
      }
      console.error("Unable to initialise identity", error);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const loadVault = async () => {
      try {
        let [storedNotes, storedFolders] = await Promise.all([listNotes(), listFolders()]);

        if (storedNotes.length === 0) {
          await saveNote(welcomeNote);
          storedNotes = [welcomeNote];
        }

        if (storedFolders.length === 0) {
          storedFolders = inferFoldersFromNotes(storedNotes);
          if (storedFolders.length > 0) await saveFolders(storedFolders);
        }

        setNotes(storedNotes);
        setFolders(storedFolders);
        setActiveNoteId(storedNotes[0]?.id ?? null);
      } catch (error) {
        setVaultLoadFailed(true);
        setWorkspaceError("Vault se nepodařilo načíst. Znovu jej otevři; původní data nebyla přepsána.");
        console.error("Unable to load vault", error);
      } finally {
        setIsReady(true);
      }
    };

    void loadVault();
  }, []);

  const activeNote = useMemo(
    () => notes.find((note) => note.id === activeNoteId) ?? null,
    [activeNoteId, notes]
  );

  useEffect(() => {
    if (!isReady || !activeNote) return;

    const carrotTimeout = window.setTimeout(() => {
      void createCarrotCommit(activeNote, currentUser, "Autosave Markdown")
        .catch((error) => setWorkspaceError(String(error)));
    }, 1600);

    return () => window.clearTimeout(carrotTimeout);
  }, [activeNote, currentUser, isReady]);

  const handleCreateNote = useCallback((folderPath: string | null = selectedFolderPath) => {
    const note = createEmptyNote("Nová poznámka", folderPath ?? "");
    setNotes((current) => [note, ...current]);
    setActiveNoteId(note.id);
    setSelectedFolderPath(folderPath ?? null);
    setView("note");
    setSidebarOpen(true);
    void persistNote(note);
    void createCarrotCommit(note, currentUser, "Created note").catch((error) => setWorkspaceError(String(error)));
  }, [currentUser, selectedFolderPath]);

  const handleCreateFolder = useCallback((parentPath: string | null, rawName: string) => {
    const name = sanitizeFolderName(rawName);
    if (!name) return;

    const path = joinFolderPath(parentPath, name);
    if (!path || folders.some((folder) => folder.path === path)) return;

    const timestamp = new Date().toISOString();
    const folder: VaultFolder = {
      id: crypto.randomUUID(),
      name,
      path,
      parentPath,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    setFolders((current) => [...current, folder].sort((left, right) => left.path.localeCompare(right.path, "cs")));
    setSelectedFolderPath(path);
    void saveFolder(folder).catch((error) => setWorkspaceError(String(error)));
  }, [folders]);

  const handleRenameFolder = useCallback((folderId: string, rawName: string) => {
    const folder = folders.find((candidate) => candidate.id === folderId);
    const name = sanitizeFolderName(rawName);

    if (!folder || !name || name === folder.name) return;

    const newPath = joinFolderPath(folder.parentPath, name);
    if (folders.some((candidate) => candidate.id !== folderId && candidate.path === newPath)) return;

    const timestamp = new Date().toISOString();
    const nextFolders = folders.map((candidate) => {
      if (!isPathInsideFolder(candidate.path, folder.path)) return candidate;

      const nextPath = renameFolderPath(candidate.path, folder.path, newPath);
      const nextParentPath = candidate.parentPath && isPathInsideFolder(candidate.parentPath, folder.path)
        ? renameFolderPath(candidate.parentPath, folder.path, newPath)
        : candidate.id === folderId
          ? folder.parentPath
          : candidate.parentPath;

      return {
        ...candidate,
        name: candidate.id === folderId ? name : candidate.name,
        path: nextPath,
        parentPath: nextParentPath,
        updatedAt: timestamp
      };
    });

    const changedNotes = notes
      .filter((note) => isPathInsideFolder(note.folder, folder.path))
      .map((note) => ({
        ...note,
        folder: renameFolderPath(note.folder, folder.path, newPath),
        updatedAt: timestamp
      }));

    void persistence.current.flush()
      .then(() => saveWorkspace(changedNotes, nextFolders))
      .then(() => {
        setFolders(nextFolders);
        setNotes((current) => current.map((note) => changedNotes.find((changed) => changed.id === note.id) ?? note));
        if (selectedFolderPath && isPathInsideFolder(selectedFolderPath, folder.path)) {
          setSelectedFolderPath(renameFolderPath(selectedFolderPath, folder.path, newPath));
        }
        return Promise.all(changedNotes.map((note) => createCarrotCommit(note, currentUser, "Folder path changed")));
      })
      .catch((error) => setWorkspaceError(String(error)));
  }, [currentUser, folders, notes, selectedFolderPath]);

  const handleDeleteFolder = useCallback((folderId: string) => {
    const folder = folders.find((candidate) => candidate.id === folderId);
    if (!folder) return;

    const hasNestedFolders = folders.some(
      (candidate) => candidate.id !== folder.id && isPathInsideFolder(candidate.path, folder.path)
    );
    const hasNotes = notes.some((note) => isPathInsideFolder(note.folder, folder.path));

    if (hasNestedFolders || hasNotes) {
      window.alert("Složka není prázdná. Nejdřív přesuň nebo smaž její obsah.");
      return;
    }

    setFolders((current) => current.filter((candidate) => candidate.id !== folderId));

    if (selectedFolderPath === folder.path) {
      setSelectedFolderPath(folder.parentPath);
    }

    void removeFolder(folderId).catch((error) => setWorkspaceError(String(error)));
  }, [folders, notes, selectedFolderPath]);

  const handleMoveNote = useCallback((noteId: string, folderPath: string | null) => {
    const note = notes.find((candidate) => candidate.id === noteId);
    if (!note || note.folder === (folderPath ?? "")) return;

    const nextNote: Note = {
      ...note,
      folder: folderPath ?? "",
      updatedAt: new Date().toISOString()
    };

    setNotes((current) => current.map((candidate) => candidate.id === noteId ? nextNote : candidate));
    setSelectedFolderPath(folderPath);
    void persistNote(nextNote);
    void createCarrotCommit(nextNote, currentUser, "Moved note").catch((error) => setWorkspaceError(String(error)));
  }, [currentUser, notes]);

  const handleDeleteNote = useCallback((noteId: string) => {
    setNotes((current) => {
      const nextNotes = current.filter((note) => note.id !== noteId);
      if (activeNoteId === noteId) setActiveNoteId(nextNotes[0]?.id ?? null);
      return nextNotes;
    });

    void persistence.current.flush().then(() => removeNote(noteId)).catch((error) => setWorkspaceError(String(error)));
  }, [activeNoteId]);

  const handleChangeNote = useCallback((nextNote: Note) => {
    setNotes((current) => current.map((note) => note.id === nextNote.id ? nextNote : note));
    void persistNote(nextNote);
  }, [persistNote, setNotes]);

  const handleOpenGraphNote = useCallback((noteId: string) => {
    setActiveNoteId(noteId);
    setView("note");
  }, []);

  const handleImportConnectorNotes = useCallback(async (incomingNotes: Note[], expectedNotes: Note[] = notesRef.current) => {
    if (incomingNotes.length === 0) return;

    const importedIds = new Set(incomingNotes.map((note) => note.id));
    await persistence.current.flush();
    const expected = new Map(expectedNotes.map((note) => [note.id, note]));
    const isCurrent = () => {
      const current = new Map(notesRef.current.map((note) => [note.id, note]));
      return incomingNotes.every((note) => JSON.stringify(current.get(note.id)) === JSON.stringify(expected.get(note.id)));
    };
    const existingPaths = new Set(foldersRef.current.map((folder) => folder.path));
    const newFolders = inferFoldersFromNotes(incomingNotes).filter((folder) => !existingPaths.has(folder.path));
    await saveImportedWorkspace(incomingNotes, newFolders, expectedNotes, isCurrent);
    if (!isCurrent()) {
      // Edits queued after the transaction must win over the imported snapshot.
      await persistence.current.flush();
      throw new Error("Konflikt importu: poznámka se během ukládání změnila. Lokální změny zůstaly zachované.");
    }
    setNotes((current) => [...incomingNotes, ...current.filter((note) => !importedIds.has(note.id))]);
    setFolders((current) => [
      ...current,
      ...newFolders
    ].sort((left, right) => left.path.localeCompare(right.path, "cs")));
    setActiveNoteId(incomingNotes[0].id);
    setView("note");

    for (let index = 0; index < incomingNotes.length; index += 8) {
      await Promise.all(incomingNotes.slice(index, index + 8).map((note) => createCarrotCommit(note, currentUser, "Imported Markdown")));
    }
  }, [currentUser, setNotes, setFolders]);

  const handleExportReceipts = useCallback(async (receipts: ExportReceipt[]) => {
    for (const receipt of receipts) {
      const current = notesRef.current.find((note) => note.id === receipt.note.id);
      if (!current) continue;
      const source = current.source;
      if (source && (source.provider !== receipt.provider || source.connectionId !== receipt.connectionId || source.relativePath !== receipt.relativePath)) continue;
      const updated = { ...current, source: {
        provider: receipt.provider, connectionId: receipt.connectionId,
        relativePath: receipt.relativePath, baselineContent: receipt.note.content, incomplete: false
      } };
      setNotes((items) => items.map((note) => note.id === current.id ? updated : note));
      try { await persistence.current.enqueue(updated); }
      catch (error) { setWorkspaceError(String(error)); throw error; }
    }
  }, [setNotes]);

  useEffect(() => {
    if (accountLocked || !window.ethicalDesktop?.ensureBackendRuntime || !window.ethicalDesktop.ensureLocalModel) return;
    let current = true;
    const ensureBackend = window.ethicalDesktop.ensureBackendRuntime;
    const ensureModel = window.ethicalDesktop.ensureLocalModel;
    const settings = loadAiSettings();
    if (settings.provider !== "ollama") return;
    void ensureBackend().then(async (runtime) => {
      if (!current || runtime.state !== "ready") return;
      const selected = loadAiSettings();
      if (selected.provider !== settings.provider || selected.model !== settings.model || selected.baseUrl !== settings.baseUrl) return;
      await ensureModel({ model: settings.model, baseUrl: settings.baseUrl, warmup: true });
    }).catch(() => {
      // Panel přípravu zopakuje a zobrazí konkrétní chybu při otevření.
    });
    return () => { current = false; };
  }, [accountLocked]);

  const handleApplyAgentAction = useCallback(async (action: AgentAction): Promise<string> => {
    await persistence.current.flush();
    const notes = notesRef.current;
    const folders = foldersRef.current;
    if (action.type === "open_note") {
      const note = notes.find((candidate) => candidate.id === action.noteId);
      if (!note) throw new Error("Poznámka už ve vaultu neexistuje.");

      setActiveNoteId(note.id);
      setSelectedFolderPath(note.folder || null);
      setView("note");
      return "Otevřena poznámka „" + note.title + "“.";
    }

    if (action.type === "create_folder") {
      const name = sanitizeFolderName(action.name);
      const parentPath = action.parentPath ? normalizeFolderPath(action.parentPath) : null;

      if (!name) throw new Error("Máša navrhla neplatný název složky.");
      if (parentPath && !folders.some((folder) => folder.path === parentPath)) {
        throw new Error("Nadřazená složka „" + parentPath + "“ neexistuje.");
      }

      const folderPath = joinFolderPath(parentPath, name);
      if (folders.some((folder) => folder.path === folderPath)) {
        throw new Error("Složka „" + folderPath + "“ už existuje.");
      }

      const timestamp = new Date().toISOString();
      const folder: VaultFolder = {
        id: crypto.randomUUID(),
        name,
        path: folderPath,
        parentPath,
        createdAt: timestamp,
        updatedAt: timestamp
      };

      await saveFolder(folder);
      setFolders((current) => [...current, folder].sort((left, right) => left.path.localeCompare(right.path, "cs")));
      setSelectedFolderPath(folder.path);
      return "Vytvořena složka „" + folder.path + "“.";
    }

    if (action.type === "create_note") {
      const title = action.title.trim().slice(0, 300) || "Máša – poznámka";
      const folderPath = normalizeFolderPath(action.folder ?? "");

      if (folderPath && !folders.some((folder) => folder.path === folderPath)) {
        throw new Error("Složka „" + folderPath + "“ neexistuje. Nejdřív ji vytvoř.");
      }

      const note = createEmptyNote(title, folderPath);
      note.content = action.content;
      note.updatedAt = new Date().toISOString();

      await saveNote(note);
      setNotes((current) => [note, ...current]);
      setActiveNoteId(note.id);
      setSelectedFolderPath(folderPath || null);
      setView("note");
      try { await createCarrotCommit(note, currentUser, "Máša created note"); }
      catch (error) { setWorkspaceError("Poznámka je uložená, ale Carrot checkpoint selhal: " + String(error)); }
      return "Vytvořena poznámka „" + note.title + "“.";
    }

    const nextNote = changedNote(action, notes);
    if (!nextNote) throw new Error("Nepodporovaná akce.");
    nextNote.folder = normalizeFolderPath(nextNote.folder);
    if (nextNote.folder && !folders.some((folder) => folder.path === nextNote.folder)) {
      throw new Error("Cílová složka neexistuje.");
    }

    const baseline = notes.find((note) => note.id === nextNote.id)!;
    await persistence.current.enqueue(nextNote);
    setNotes((current) => current.map((note) => note.id === nextNote.id && note.content === baseline.content && note.title === baseline.title && note.folder === baseline.folder ? nextNote : note));
    try { await createCarrotCommit(nextNote, currentUser, "Máša updated note"); }
    catch (error) { setWorkspaceError("Změna je uložená, ale Carrot checkpoint selhal: " + String(error)); }
    return "Upravena poznámka „" + nextNote.title + "“.";
  }, [currentUser, folders, notes]);

  const toggleAiPanel = useCallback(() => {
    if (accountLocked) return;

    setAiOpen((current) => {
      const next = !current;
      if (next) setAiLoaded(true);
      return next;
    });
  }, [accountLocked]);

  const togglePet = useCallback(() => {
    setPetVisible((current) => !current);
  }, []);

  useEffect(() => {
    try { localStorage.setItem("ethical-world-masa-pet-v1", petVisible ? "visible" : "hidden"); }
    catch { /* The companion still works when preference storage is unavailable. */ }
  }, [petVisible]);

  useEffect(() => {
    const handleKeyboardShortcut = (event: KeyboardEvent) => {
      if (accountLocked) return;
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;

      const key = event.key.toLocaleLowerCase("cs-CZ");

      if (key === "n") {
        event.preventDefault();

        if (event.shiftKey) {
          setSidebarOpen(true);
          setFolderCreateNonce((current) => current + 1);
        } else {
          handleCreateNote(selectedFolderPath);
        }

        return;
      }

      if (key === "b") {
        event.preventDefault();
        setSidebarOpen((current) => !current);
      }

      if (key === "j") {
        event.preventDefault();
        toggleAiPanel();
      }
    };

    window.addEventListener("keydown", handleKeyboardShortcut);
    return () => window.removeEventListener("keydown", handleKeyboardShortcut);
  }, [accountLocked, handleCreateNote, selectedFolderPath, toggleAiPanel]);

  const handleSecurityChange = useCallback((locked: boolean) => {
    setAccountLocked(locked);
    if (locked) {
      setSidebarOpen(false);
      setAiOpen(false);
      setView("account");
    }
  }, []);

  if (vaultLoadFailed) {
    return <main role="alert">{workspaceError}<button type="button" onClick={() => window.location.reload()}>Znovu načíst vault</button></main>;
  }
  if (!isReady) {
    return <div className="loading-screen">Načítám lokální vault…</div>;
  }

  const workspaceLabel = view === "graph"
    ? "Knowledge graph"
    : view === "connectors"
      ? "Connectors"
      : view === "guide"
        ? "Guide"
        : view === "account"
          ? "Account"
          : activeNote?.title || "Žádná poznámka";
  const workspacePath = view === "graph"
    ? "Global view"
    : view === "connectors"
      ? "Integrations"
      : view === "guide"
        ? "Help"
        : view === "account"
          ? "Identity"
          : activeNote?.folder || "Vault root";

  return (
    <div className={`workbench ${sidebarOpen ? "sidebar-open" : ""} ${aiOpen ? "ai-open" : ""}`}>
      {workspaceError && <div role="alert" className="workspace-error">
        {workspaceError}
        <button type="button" onClick={() => vaultLoadFailed ? window.location.reload() : setWorkspaceError(null)}>
          {vaultLoadFailed ? "Znovu načíst" : "Zavřít"}
        </button>
      </div>}
      <header className="app-topbar">
        <div className="topbar-brand">
          <div className="topbar-logo">
            <img src="./ethical-world-mark.svg" alt="" aria-hidden="true" />
          </div>
          <strong>Ethical World</strong>
        </div>

        <div className="topbar-context">
          <span>{workspacePath}</span>
          <b>›</b>
          <strong>{workspaceLabel}</strong>
        </div>

        <div className="topbar-actions">
          <button type="button" onClick={() => setSidebarOpen((current) => !current)} title="Files panel (Ctrl+B)">
            {sidebarOpen ? "Hide files" : "Files"}
          </button>
          <button type="button" onClick={toggleAiPanel} title="Máša panel (Ctrl+J)">
            {aiOpen ? "Hide Máša" : "Máša"}
          </button>
          {!accountLocked && <button type="button" onClick={togglePet} aria-pressed={petVisible} title="Zobrazit nebo skrýt postavičku Máši">Pet</button>}
        </div>
      </header>

      <div className="workbench-body">
        <ActivityRail
          view={view}
          sidebarOpen={sidebarOpen}
          aiOpen={aiOpen}
          onViewChange={(nextView) => setView(accountLocked ? "account" : nextView)}
          onToggleSidebar={() => {
            if (!accountLocked) setSidebarOpen((current) => !current);
          }}
          onToggleAi={toggleAiPanel}
        />

        {sidebarOpen && !accountLocked && (
          <VaultSidebar
            notes={notes}
            folders={folders}
            activeNoteId={activeNoteId}
            selectedFolderPath={selectedFolderPath}
            query={query}
            folderCreateNonce={folderCreateNonce}
            onViewChange={(nextView) => setView(accountLocked ? "account" : nextView)}
            onQueryChange={setQuery}
            onSelectNote={setActiveNoteId}
            onSelectFolder={setSelectedFolderPath}
            onCreateNote={handleCreateNote}
            onCreateFolder={handleCreateFolder}
            onRenameFolder={handleRenameFolder}
            onDeleteFolder={handleDeleteFolder}
            onDeleteNote={handleDeleteNote}
            onMoveNote={handleMoveNote}
          />
        )}

        {view === "graph" ? (
          <Suspense fallback={<main className="graph-pane loading-screen">Načítám knowledge graph…</main>}>
            <GraphPane notes={notes} activeNoteId={activeNoteId} onOpenNote={handleOpenGraphNote} />
          </Suspense>
        ) : view === "connectors" ? (
          <Suspense fallback={<main className="connector-pane loading-screen">Načítám konektory…</main>}>
            <ConnectorPanel notes={notes} onImportNotes={handleImportConnectorNotes} onExportReceipts={handleExportReceipts} />
          </Suspense>
        ) : view === "guide" ? (
          <Suspense fallback={<main className="guide-pane loading-screen">Načítám návod…</main>}>
            <GuidePanel />
          </Suspense>
        ) : view === "account" || accountLocked ? (
          <Suspense fallback={<main className="account-pane loading-screen">Načítám účet…</main>}>
            <AccountPanel
              onUserChange={setCurrentUser}
              onSecurityStateChange={handleSecurityChange}
            />
          </Suspense>
        ) : (
          <EditorPane
            saveState={activeNote ? saveStates[activeNote.id] ?? "uloženo" : ""}
            note={activeNote}
            notes={notes}
            folders={folders}
            onChange={handleChangeNote}
            onOpenNote={setActiveNoteId}
          />
        )}

        {aiLoaded && !accountLocked && (
          <Suspense fallback={aiOpen ? <aside className="ai-panel loading-screen">Načítám AI panel…</aside> : null}>
            <AiPanel
              activeNote={activeNote}
              notes={notes}
              folders={folders}
              visible={aiOpen}
              onRequestHide={() => setAiOpen(false)}
              onApplyAgentAction={handleApplyAgentAction}
              onPetStateChange={setPetState}
            />
          </Suspense>
        )}
      </div>

      {!accountLocked && petVisible && !aiOpen && <MasaPet state={aiLoaded ? petState : "idle"} onOpen={toggleAiPanel} onHide={togglePet} />}

      <footer className="studio-credit">
        Created by Rabbithollow Code Studio™
      </footer>
    </div>
  );
}
