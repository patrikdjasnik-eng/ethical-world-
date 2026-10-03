import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { EditorPane } from "./components/EditorPane";
import { VaultSidebar, type WorkspaceView } from "./components/VaultSidebar";
import {
  inferFoldersFromNotes,
  isPathInsideFolder,
  joinFolderPath,
  renameFolderPath,
  sanitizeFolderName
} from "./lib/folders";
import { createEmptyNote } from "./lib/notes";
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
import type { Note, VaultFolder } from "./types";

const AiPanel = lazy(() => import("./components/AiPanel"));
const GraphPane = lazy(() => import("./components/GraphPane"));
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
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const loadVault = async () => {
      try {
        let [storedNotes, storedFolders] = await Promise.all([
          listNotes(),
          listFolders()
        ]);

        if (storedNotes.length === 0) {
          await saveNote(welcomeNote);
          storedNotes = [welcomeNote];
        }

        if (storedFolders.length === 0) {
          storedFolders = inferFoldersFromNotes(storedNotes);

          if (storedFolders.length > 0) {
            await saveFolders(storedFolders);
          }
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
    if (!isReady || !activeNote) {
      return;
    }

    const timeout = window.setTimeout(() => {
      void saveNote(activeNote).catch((error) => console.error("Autosave failed", error));
    }, 450);

    return () => window.clearTimeout(timeout);
  }, [activeNote, isReady]);

  const handleCreateNote = useCallback((folderPath: string | null = selectedFolderPath) => {
    const note = createEmptyNote("Nová poznámka", folderPath ?? "");
    setNotes((current) => [note, ...current]);
    setActiveNoteId(note.id);
    setSelectedFolderPath(folderPath ?? null);
    setView("note");
    void saveNote(note);
  }, [selectedFolderPath]);

  const handleCreateFolder = useCallback((parentPath: string | null, rawName: string) => {
    const name = sanitizeFolderName(rawName);

    if (!name) {
      return;
    }

    const path = joinFolderPath(parentPath, name);

    if (!path || folders.some((folder) => folder.path === path)) {
      return;
    }

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

    if (!folder || !name || name === folder.name) {
      return;
    }

    const newPath = joinFolderPath(folder.parentPath, name);

    if (folders.some((candidate) => candidate.id !== folderId && candidate.path === newPath)) {
      return;
    }

    const timestamp = new Date().toISOString();
    const nextFolders = folders.map((candidate) => {
      if (!isPathInsideFolder(candidate.path, folder.path)) {
        return candidate;
      }

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
      saveNotes(changedNotes)
    ]);
  }, [folders, notes, selectedFolderPath]);

  const handleDeleteFolder = useCallback((folderId: string) => {
    const folder = folders.find((candidate) => candidate.id === folderId);

    if (!folder) {
      return;
    }

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

  const handleDeleteNote = useCallback((noteId: string) => {
    setNotes((current) => {
      const nextNotes = current.filter((note) => note.id !== noteId);

      if (activeNoteId === noteId) {
        setActiveNoteId(nextNotes[0]?.id ?? null);
      }

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

  if (!isReady) {
    return <div className="loading-screen">Načítám lokální vault…</div>;
  }

  return (
    <div className="app-shell">
      <VaultSidebar
        notes={notes}
        folders={folders}
        activeNoteId={activeNoteId}
        selectedFolderPath={selectedFolderPath}
        query={query}
        view={view}
        onViewChange={setView}
        onQueryChange={setQuery}
        onSelectNote={setActiveNoteId}
        onSelectFolder={setSelectedFolderPath}
        onCreateNote={handleCreateNote}
        onCreateFolder={handleCreateFolder}
        onRenameFolder={handleRenameFolder}
        onDeleteFolder={handleDeleteFolder}
        onDeleteNote={handleDeleteNote}
      />

      {view === "graph" ? (
        <Suspense fallback={<main className="graph-pane loading-screen">Načítám knowledge graph…</main>}>
          <GraphPane notes={notes} activeNoteId={activeNoteId} onOpenNote={handleOpenGraphNote} />
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

      <Suspense fallback={<aside className="ai-panel loading-screen">Načítám AI panel…</aside>}>
        <AiPanel activeNote={activeNote} notes={notes} />
      </Suspense>
    </div>
  );
}
