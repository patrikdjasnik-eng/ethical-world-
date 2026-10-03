import { memo, useMemo } from "react";
import { searchNotes } from "../lib/notes";
import type { Note } from "../types";

export type WorkspaceView = "note" | "graph";

interface VaultSidebarProps {
  notes: Note[];
  activeNoteId: string | null;
  query: string;
  view: WorkspaceView;
  onViewChange: (view: WorkspaceView) => void;
  onQueryChange: (value: string) => void;
  onSelectNote: (noteId: string) => void;
  onCreateNote: () => void;
  onDeleteNote: (noteId: string) => void;
}

export const VaultSidebar = memo(function VaultSidebar({
  notes,
  activeNoteId,
  query,
  view,
  onViewChange,
  onQueryChange,
  onSelectNote,
  onCreateNote,
  onDeleteNote
}: VaultSidebarProps) {
  const filteredNotes = useMemo(() => searchNotes(notes, query), [notes, query]);

  const openNote = (noteId: string) => {
    onSelectNote(noteId);
    onViewChange("note");
  };

  return (
    <aside className="vault-sidebar">
      <div className="workspace-header">
        <div className="workspace-mark">E</div>
        <div className="workspace-copy">
          <strong>Ethical World</strong>
          <span>Local vault</span>
        </div>
        <button className="icon-button subtle" type="button" title="Nastavení vaultu" aria-label="Nastavení vaultu">
          ⋯
        </button>
      </div>

      <div className="workspace-nav">
        <button
          type="button"
          className={view === "note" ? "active" : ""}
          onClick={() => onViewChange("note")}
        >
          <span>▱</span>
          Notes
        </button>
        <button
          type="button"
          className={view === "graph" ? "active" : ""}
          onClick={() => onViewChange("graph")}
        >
          <span>⌘</span>
          Graph
        </button>
      </div>

      <div className="sidebar-actions">
        <button className="new-note-button" type="button" onClick={onCreateNote}>
          <span>＋</span>
          Nová poznámka
        </button>
      </div>

      <div className="search-shell">
        <span>⌕</span>
        <input
          className="search-input"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Hledat"
          aria-label="Hledat poznámky"
        />
      </div>

      <div className="section-label">
        <span>POZNÁMKY</span>
        <span>{filteredNotes.length}</span>
      </div>

      <div className="note-list" role="list">
        {filteredNotes.map((note) => (
          <div
            className={`note-row ${note.id === activeNoteId && view === "note" ? "active" : ""}`}
            key={note.id}
            role="listitem"
          >
            <button type="button" className="note-open" onClick={() => openNote(note.id)}>
              <span className="file-icon">▱</span>
              <span className="note-copy">
                <strong>{note.title || "Bez názvu"}</strong>
                <small>{note.folder}</small>
              </span>
            </button>

            <button
              className="icon-button danger note-delete"
              type="button"
              onClick={() => onDeleteNote(note.id)}
              aria-label={`Smazat ${note.title}`}
              title="Smazat poznámku"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <div className="sidebar-footer">
        <span><i className="footer-dot" /> Local</span>
        <span>{notes.length} souborů</span>
      </div>
    </aside>
  );
});
