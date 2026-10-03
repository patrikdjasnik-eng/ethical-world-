import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { ActivityRail } from "./components/ActivityRail";
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
import { createEmptyNote } from "./lib/notes";
import { createCarrotCommit } from "./lib/carrot";
import { bootstrapOwnerAccount, restoreAccount } from "./lib/auth";
import {
  listFolders,
  listNotes,
  removeFolder,
  removeNote,
  saveFolder,
  saveFolders,
  saveNote,
  saveNotes
} from "./lib/storage";
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
  const [notes, setNotes] = useState<Note[]>([]);
  const [folders, setFolders] = useState<VaultFolder[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [selectedFolderPath, setSelectedFolderPath] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<WorkspaceView>("note");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [aiOpen, setAiOpen] = useState(false);
  const [accountLocked, setAccountLocked] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [folderCreateNonce, setFolderCreateNonce] = useState(0);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const initialiseIdentity = async () => {
      let profile = await restoreAccount();

      if (!profile) {
        const bootstrap = await bootstrapOwnerAccount();
        profile = bootstrap?.user ?? null;
      }

      if (cancelled || !profile) return;

      setCurrentUser(profile);

      if (profile.mustChangePassword) {
        setAccountLocked(true);
        setSidebarOpen(false);
        setAiOpen(false);
        setView("account");
      }
    };

    void initialiseIdentity().catch((error) => {
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

    const saveTimeout = window.setTimeout(() => {
      void saveNote(activeNote).catch((error) => console.error("Autosave failed", error));
    }, 450);

    const carrotTimeout = window.setTimeout(() => {
      void createCarrotCommit(activeNote, currentUser, "Autosave Markdown")
        .catch((error) => console.error("Carrot autosave failed", error));
    }, 1600);

    return () => {
      window.clearTimeout(saveTimeout);
      window.clearTimeout(carrotTimeout);
    };
  }, [activeNote, currentUser, isReady]);

  const handleCreateNote = useCallback((folderPath: string | null = selectedFolderPath) => {
    const note = createEmptyNote("Nová poznámka", folderPath ?? "");
    setNotes((current) => [note, ...current]);
    setActiveNoteId(note.id);
    setSelectedFolderPath(folderPath ?? null);
    setView("note");
    setSidebarOpen(true);
    void saveNote(note);
    void createCarrotCommit(note, currentUser, "Created note");
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
    void saveFolder(folder);
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

    setFolders(nextFolders);
    setNotes((current) => current.map((note) => changedNotes.find((changed) => changed.id === note.id) ?? note));

    if (selectedFolderPath && isPathInsideFolder(selectedFolderPath, folder.path)) {
      setSelectedFolderPath(renameFolderPath(selectedFolderPath, folder.path, newPath));
    }

    void Promise.all([
      saveFolders(nextFolders.filter((candidate) => isPathInsideFolder(candidate.path, newPath))),
      saveNotes(changedNotes),
      ...changedNotes.map((note) => createCarrotCommit(note, currentUser, "Folder path changed"))
    ]);
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

    void removeFolder(folderId);
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
    void saveNote(nextNote);
    void createCarrotCommit(nextNote, currentUser, "Moved note");
  }, [currentUser, notes]);

  const handleDeleteNote = useCallback((noteId: string) => {
    setNotes((current) => {
      const nextNotes = current.filter((note) => note.id !== noteId);
      if (activeNoteId === noteId) setActiveNoteId(nextNotes[0]?.id ?? null);
      return nextNotes;
    });

    void removeNote(noteId);
  }, [activeNoteId]);

  const handleChangeNote = useCallback((nextNote: Note) => {
    setNotes((current) => current.map((note) => note.id === nextNote.id ? nextNote : note));
  }, []);

  const handleOpenGraphNote = useCallback((noteId: string) => {
    setActiveNoteId(noteId);
    setView("note");
  }, []);

  const handleImportConnectorNotes = useCallback(async (incomingNotes: Note[]) => {
    if (incomingNotes.length === 0) return;

    const importedIds = new Set(incomingNotes.map((note) => note.id));
    const mergedNotes = [
      ...incomingNotes,
      ...notes.filter((note) => !importedIds.has(note.id))
    ];

    const inferredFolders = inferFoldersFromNotes(incomingNotes);
    const existingPaths = new Set(folders.map((folder) => folder.path));
    const newFolders = inferredFolders.filter((folder) => !existingPaths.has(folder.path));

    setNotes(mergedNotes);
    setFolders((current) => [
      ...current,
      ...newFolders
    ].sort((left, right) => left.path.localeCompare(right.path, "cs")));
    setActiveNoteId(incomingNotes[0]?.id ?? activeNoteId);
    setView("note");

    await Promise.all([
      saveNotes(incomingNotes),
      saveFolders(newFolders),
      ...incomingNotes.map((note) => createCarrotCommit(note, currentUser, "Imported Markdown"))
    ]);
  }, [activeNoteId, currentUser, folders, notes]);

  const handleApplyAgentAction = useCallback(async (action: AgentAction): Promise<string> => {
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

      setFolders((current) => [...current, folder].sort((left, right) => left.path.localeCompare(right.path, "cs")));
      setSelectedFolderPath(folder.path);
      await saveFolder(folder);
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

      setNotes((current) => [note, ...current]);
      setActiveNoteId(note.id);
      setSelectedFolderPath(folderPath || null);
      setView("note");
      await saveNote(note);
      await createCarrotCommit(note, currentUser, "Máša created note");
      return "Vytvořena poznámka „" + note.title + "“.";
    }

    const currentNote = notes.find((candidate) => candidate.id === action.noteId);
    if (!currentNote) throw new Error("Poznámka určená k úpravě už neexistuje.");

    const nextFolder = action.folder === undefined
      ? currentNote.folder
      : normalizeFolderPath(action.folder);

    if (nextFolder && !folders.some((folder) => folder.path === nextFolder)) {
      throw new Error("Složka „" + nextFolder + "“ neexistuje.");
    }

    const nextNote: Note = {
      ...currentNote,
      title: action.title === undefined
        ? currentNote.title
        : action.title.trim().slice(0, 300) || currentNote.title,
      content: action.content ?? currentNote.content,
      folder: nextFolder,
      updatedAt: new Date().toISOString()
    };

    setNotes((current) => current.map((note) => note.id === nextNote.id ? nextNote : note));
    await saveNote(nextNote);
    await createCarrotCommit(nextNote, currentUser, "Máša updated note");
    return "Upravena poznámka „" + nextNote.title + "“.";
  }, [currentUser, folders, notes]);

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
        setAiOpen((current) => !current);
      }
    };

    window.addEventListener("keydown", handleKeyboardShortcut);
    return () => window.removeEventListener("keydown", handleKeyboardShortcut);
  }, [accountLocked, handleCreateNote, selectedFolderPath]);

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
      <header className="app-topbar">
        <div className="topbar-brand">
          <div className="topbar-logo">\n            <img src="/ethical-world-mark.svg" alt="" aria-hidden="true" />\n          </div>
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
          <button type="button" onClick={() => setAiOpen((current) => !current)} title="Máša panel (Ctrl+J)">
            {aiOpen ? "Hide Máša" : "Máša"}
          </button>
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
          onToggleAi={() => {
            if (!accountLocked) setAiOpen((current) => !current);
          }}
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
            <ConnectorPanel notes={notes} onImportNotes={handleImportConnectorNotes} />
          </Suspense>
        ) : view === "guide" ? (
          <Suspense fallback={<main className="guide-pane loading-screen">Načítám návod…</main>}>
            <GuidePanel />
          </Suspense>
        ) : view === "account" || accountLocked ? (
          <Suspense fallback={<main className="account-pane loading-screen">Načítám účet…</main>}>
            <AccountPanel
              onUserChange={setCurrentUser}
              onSecurityStateChange={(locked) => {
                setAccountLocked(locked);
                if (locked) {
                  setSidebarOpen(false);
                  setAiOpen(false);
                  setView("account");
                }
              }}
            />
          </Suspense>
        ) : (
          <EditorPane
            note={activeNote}
            notes={notes}
            folders={folders}
            onChange={handleChangeNote}
            onOpenNote={setActiveNoteId}
          />
        )}

        {aiOpen && !accountLocked && (
          <Suspense fallback={<aside className="ai-panel loading-screen">Načítám AI panel…</aside>}>
            <AiPanel
              activeNote={activeNote}
              notes={notes}
              folders={folders}
              onApplyAgentAction={handleApplyAgentAction}
            />
          </Suspense>
        )}
      </div>
    </div>
  );
}
