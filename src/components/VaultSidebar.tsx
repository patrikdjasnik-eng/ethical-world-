import { memo, useEffect, useMemo, useState } from "react";
import { buildFolderTree, type FolderTreeNode } from "../lib/folders";
import { searchNotes } from "../lib/notes";
import type { Note, VaultFolder } from "../types";

export type WorkspaceView = "note" | "graph";

interface VaultSidebarProps {
  notes: Note[];
  folders: VaultFolder[];
  activeNoteId: string | null;
  selectedFolderPath: string | null;
  query: string;
  view: WorkspaceView;
  folderCreateNonce: number;
  onViewChange: (view: WorkspaceView) => void;
  onQueryChange: (value: string) => void;
  onSelectNote: (noteId: string) => void;
  onSelectFolder: (folderPath: string | null) => void;
  onCreateNote: (folderPath?: string | null) => void;
  onCreateFolder: (parentPath: string | null, name: string) => void;
  onRenameFolder: (folderId: string, nextName: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onDeleteNote: (noteId: string) => void;
  onMoveNote: (noteId: string, folderPath: string | null) => void;
}

interface FolderRowProps {
  node: FolderTreeNode;
  depth: number;
  activeNoteId: string | null;
  selectedFolderPath: string | null;
  expandedFolders: Set<string>;
  onToggleFolder: (folderPath: string) => void;
  onSelectFolder: (folderPath: string) => void;
  onOpenNote: (noteId: string) => void;
  onCreateNote: (folderPath: string) => void;
  onStartRename: (folder: VaultFolder) => void;
  onDeleteFolder: (folderId: string) => void;
  onDeleteNote: (noteId: string) => void;
  onMoveNote: (noteId: string, folderPath: string | null) => void;
}

function beginNoteDrag(event: React.DragEvent, noteId: string) {
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("application/x-ethical-world-note", noteId);
}

function getDraggedNoteId(event: React.DragEvent): string {
  return event.dataTransfer.getData("application/x-ethical-world-note");
}

function FolderRow({
  node,
  depth,
  activeNoteId,
  selectedFolderPath,
  expandedFolders,
  onToggleFolder,
  onSelectFolder,
  onOpenNote,
  onCreateNote,
  onStartRename,
  onDeleteFolder,
  onDeleteNote,
  onMoveNote
}: FolderRowProps) {
  const isExpanded = expandedFolders.has(node.folder.path);
  const isSelected = selectedFolderPath === node.folder.path;

  return (
    <div className="tree-branch">
      <div
        className={`folder-row ${isSelected ? "selected" : ""}`}
        style={{ paddingLeft: 6 + depth * 14 }}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
        }}
        onDrop={(event) => {
          event.preventDefault();
          const noteId = getDraggedNoteId(event);
          if (noteId) onMoveNote(noteId, node.folder.path);
        }}
      >
        <button
          className="tree-chevron"
          type="button"
          onClick={() => onToggleFolder(node.folder.path)}
          aria-label={isExpanded ? "Sbalit složku" : "Rozbalit složku"}
        >
          {isExpanded ? "⌄" : "›"}
        </button>

        <button
          className="folder-open"
          type="button"
          onClick={() => onSelectFolder(node.folder.path)}
          onDoubleClick={() => onToggleFolder(node.folder.path)}
        >
          <span className="folder-icon">{isExpanded ? "▾" : "▸"}</span>
          <span>{node.folder.name}</span>
        </button>

        <div className="tree-actions">
          <button type="button" onClick={() => onCreateNote(node.folder.path)} title="Nová poznámka ve složce">＋</button>
          <button type="button" onClick={() => onStartRename(node.folder)} title="Přejmenovat složku">✎</button>
          <button type="button" onClick={() => onDeleteFolder(node.folder.id)} title="Smazat složku">×</button>
        </div>
      </div>

      {isExpanded && (
        <div>
          {node.children.map((child) => (
            <FolderRow
              key={child.folder.id}
              node={child}
              depth={depth + 1}
              activeNoteId={activeNoteId}
              selectedFolderPath={selectedFolderPath}
              expandedFolders={expandedFolders}
              onToggleFolder={onToggleFolder}
              onSelectFolder={onSelectFolder}
              onOpenNote={onOpenNote}
              onCreateNote={onCreateNote}
              onStartRename={onStartRename}
              onDeleteFolder={onDeleteFolder}
              onDeleteNote={onDeleteNote}
              onMoveNote={onMoveNote}
            />
          ))}

          {node.notes.map((note) => (
            <div
              className={`tree-note-row ${note.id === activeNoteId ? "active" : ""}`}
              style={{ paddingLeft: 28 + depth * 14 }}
              key={note.id}
              draggable
              onDragStart={(event) => beginNoteDrag(event, note.id)}
            >
              <button type="button" className="tree-note-open" onClick={() => onOpenNote(note.id)}>
                <span>▱</span>
                <strong>{note.title || "Bez názvu"}</strong>
              </button>
              <button className="tree-note-delete" type="button" onClick={() => onDeleteNote(note.id)} title="Smazat poznámku">×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export const VaultSidebar = memo(function VaultSidebar({
  notes,
  folders,
  activeNoteId,
  selectedFolderPath,
  query,
  view,
  folderCreateNonce,
  onViewChange,
  onQueryChange,
  onSelectNote,
  onSelectFolder,
  onCreateNote,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onDeleteNote,
  onMoveNote
}: VaultSidebarProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => new Set());
  const [newFolderParent, setNewFolderParent] = useState<string | null | undefined>(undefined);
  const [newFolderName, setNewFolderName] = useState("");
  const [renamingFolder, setRenamingFolder] = useState<VaultFolder | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const filteredNotes = useMemo(() => searchNotes(notes, query), [notes, query]);
  const tree = useMemo(
    () => buildFolderTree(folders, query ? filteredNotes : notes),
    [filteredNotes, folders, notes, query]
  );

  useEffect(() => {
    if (folderCreateNonce === 0) {
      return;
    }

    setNewFolderParent(selectedFolderPath);
    setNewFolderName("");
  }, [folderCreateNonce, selectedFolderPath]);

  const openNote = (noteId: string) => {
    onSelectNote(noteId);
    onViewChange("note");
  };

  const toggleFolder = (folderPath: string) => {
    setExpandedFolders((current) => {
      const next = new Set(current);

      if (next.has(folderPath)) next.delete(folderPath);
      else next.add(folderPath);

      return next;
    });
  };

  const beginCreateFolder = () => {
    setNewFolderParent(selectedFolderPath);
    setNewFolderName("");
  };

  const submitCreateFolder = () => {
    const name = newFolderName.trim();
    if (!name) return;

    onCreateFolder(newFolderParent ?? null, name);
    setNewFolderParent(undefined);
    setNewFolderName("");
  };

  const startRenameFolder = (folder: VaultFolder) => {
    setRenamingFolder(folder);
    setRenameValue(folder.name);
  };

  const submitRenameFolder = () => {
    if (!renamingFolder || !renameValue.trim()) return;

    onRenameFolder(renamingFolder.id, renameValue.trim());
    setRenamingFolder(null);
    setRenameValue("");
  };

  return (
    <aside className="vault-sidebar">
      <div className="workspace-header">
        <div className="workspace-mark">E</div>
        <div className="workspace-copy">
          <strong>Ethical World</strong>
          <span>Local vault</span>
        </div>
        <button className="icon-button subtle" type="button" title="Nastavení vaultu" aria-label="Nastavení vaultu">⋯</button>
      </div>

      <div className="workspace-nav">
        <button type="button" className={view === "note" ? "active" : ""} onClick={() => onViewChange("note")}>
          <span>▱</span> Notes
        </button>
        <button type="button" className={view === "graph" ? "active" : ""} onClick={() => onViewChange("graph")}>
          <span>⌘</span> Graph
        </button>
      </div>

      <div className="file-toolbar">
        <span>FILES</span>
        <div>
          <button type="button" onClick={() => onCreateNote(selectedFolderPath)} title="Nová poznámka (Ctrl+N)">＋▱</button>
          <button type="button" onClick={beginCreateFolder} title="Nová složka (Ctrl+Shift+N)">＋□</button>
        </div>
      </div>

      <div className="search-shell">
        <span>⌕</span>
        <input className="search-input" value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Hledat ve vaultu" aria-label="Hledat poznámky" />
      </div>

      {newFolderParent !== undefined && (
        <div className="inline-tree-editor">
          <span>□</span>
          <input
            autoFocus
            value={newFolderName}
            onChange={(event) => setNewFolderName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") submitCreateFolder();
              if (event.key === "Escape") setNewFolderParent(undefined);
            }}
            onBlur={() => {
              if (newFolderName.trim()) submitCreateFolder();
              else setNewFolderParent(undefined);
            }}
            placeholder={newFolderParent ? "Nová podsložka" : "Nová složka"}
          />
        </div>
      )}

      {renamingFolder && (
        <div className="inline-tree-editor">
          <span>□</span>
          <input
            autoFocus
            value={renameValue}
            onChange={(event) => setRenameValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") submitRenameFolder();
              if (event.key === "Escape") setRenamingFolder(null);
            }}
            onBlur={submitRenameFolder}
          />
        </div>
      )}

      <div className="vault-tree" role="tree">
        <button
          type="button"
          className={`root-folder-row ${selectedFolderPath === null ? "selected" : ""}`}
          onClick={() => onSelectFolder(null)}
          onDragOver={(event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
          }}
          onDrop={(event) => {
            event.preventDefault();
            const noteId = getDraggedNoteId(event);
            if (noteId) onMoveNote(noteId, null);
          }}
        >
          <span>⌂</span> Vault root
        </button>

        {tree.rootNotes.map((note) => (
          <div
            className={`tree-note-row root-note ${note.id === activeNoteId ? "active" : ""}`}
            key={note.id}
            draggable
            onDragStart={(event) => beginNoteDrag(event, note.id)}
          >
            <button type="button" className="tree-note-open" onClick={() => openNote(note.id)}>
              <span>▱</span>
              <strong>{note.title || "Bez názvu"}</strong>
            </button>
            <button className="tree-note-delete" type="button" onClick={() => onDeleteNote(note.id)} title="Smazat poznámku">×</button>
          </div>
        ))}

        {tree.roots.map((node) => (
          <FolderRow
            key={node.folder.id}
            node={node}
            depth={0}
            activeNoteId={activeNoteId}
            selectedFolderPath={selectedFolderPath}
            expandedFolders={expandedFolders}
            onToggleFolder={toggleFolder}
            onSelectFolder={(folderPath) => {
              onSelectFolder(folderPath);
              setExpandedFolders((current) => new Set(current).add(folderPath));
            }}
            onOpenNote={openNote}
            onCreateNote={onCreateNote}
            onStartRename={startRenameFolder}
            onDeleteFolder={onDeleteFolder}
            onDeleteNote={onDeleteNote}
            onMoveNote={onMoveNote}
          />
        ))}

        {query && filteredNotes.length === 0 && <div className="tree-empty">Nic nenalezeno</div>}
      </div>

      <div className="sidebar-footer">
        <span><i className="footer-dot" /> Local</span>
        <span>{folders.length} složek · {notes.length} poznámek</span>
      </div>
    </aside>
  );
});
