import { memo, useMemo } from "react";
import { searchNotes } from "../lib/notes";
import type { Note } from "../types";

interface VaultSidebarProps {
  notes: Note[];
  activeNoteId: string | null;
  query: string;
  onQueryChange: (value: string) => void;
  onSelectNote: (noteId: string) => void;
  onCreateNote: () => void;
  onDeleteNote: (noteId: string) => void;
}

export const VaultSidebar = memo(function VaultSidebar({
  notes,
  activeNoteId,
  query,
  onQueryChange,
  onSelectNote,
  onCreateNote,
  onDeleteNote
}: VaultSidebarProps) {
  const filteredNotes = useMemo(() => searchNotes(notes, query), [notes, query]);

  return (
    <aside className="vault-sidebar">
      <div className="brand-row">
        <div className="brand-mark">EW</div>
        <div>
          <strong>Ethical World</strong>
          <span>local knowledge OS</span>
        </div>
      </div>

      <button className="primary-button" type="button" onClick={onCreateNote}>
        + Nová poznámka
      </button>

      <input
        className="search-input"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder="Hledat ve vaultu…"
        aria-label="Hledat poznámky"
      />

      <div className="note-list" role="list">
        {filteredNotes.map((note) => (
          <div
            className={`note-row ${note.id === activeNoteId ? "active" : ""}`}
            key={note.id}
            role="listitem"
          >
            <button type="button" className="note-open" onClick={() => onSelectNote(note.id)}>
              <span>{note.title || "Bez názvu"}</span>
              <small>{note.folder}</small>
            </button>
            <button
              className="icon-button danger"
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
        <span>{notes.length} poznámek</span>
        <span>offline-first</span>
      </div>
    </aside>
  );
});
