import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { EditorPane } from "./components/EditorPane";
import { VaultSidebar } from "./components/VaultSidebar";
import { createEmptyNote } from "./lib/notes";
import { listNotes, removeNote, saveNote } from "./lib/storage";
import type { Note } from "./types";

const AiPanel = lazy(() => import("./components/AiPanel"));
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
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const loadVault = async () => {
      try {
        const storedNotes = await listNotes();
        if (storedNotes.length === 0) {
          await saveNote(welcomeNote);
          setNotes([welcomeNote]);
          setActiveNoteId(welcomeNote.id);
        } else {
          setNotes(storedNotes);
          setActiveNoteId(storedNotes[0].id);
        }
      } catch (error) {
        console.error("Unable to load vault", error);
      } finally {
        setIsReady(true);
      }
    };
    void loadVault();
  }, []);

  const activeNote = useMemo(() => notes.find((note) => note.id === activeNoteId) ?? null, [activeNoteId, notes]);

  useEffect(() => {
    if (!isReady || !activeNote) return;
    const timeout = window.setTimeout(() => {
      void saveNote(activeNote).catch((error) => console.error("Autosave failed", error));
    }, 450);
    return () => window.clearTimeout(timeout);
  }, [activeNote, isReady]);

  const handleCreateNote = useCallback(() => {
    const note = createEmptyNote();
    setNotes((current) => [note, ...current]);
    setActiveNoteId(note.id);
    void saveNote(note);
  }, []);

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

  if (!isReady) return <div className="loading-screen">Načítám lokální vault…</div>;

  return (
    <div className="app-shell">
      <VaultSidebar notes={notes} activeNoteId={activeNoteId} query={query} onQueryChange={setQuery} onSelectNote={setActiveNoteId} onCreateNote={handleCreateNote} onDeleteNote={handleDeleteNote} />
      <EditorPane note={activeNote} notes={notes} onChange={handleChangeNote} onOpenNote={setActiveNoteId} />
      <Suspense fallback={<aside className="ai-panel loading-screen">Načítám AI panel…</aside>}>
        <AiPanel activeNote={activeNote} notes={notes} />
      </Suspense>
    </div>
  );
}
