import { memo, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { extractWikiLinks, getBacklinks, normalizeTitle } from "../lib/notes";
import type { Note, VaultFolder } from "../types";

interface EditorPaneProps {
  note: Note | null;
  notes: Note[];
  folders: VaultFolder[];
  onChange: (nextNote: Note) => void;
  onOpenNote: (noteId: string) => void;
}

export const EditorPane = memo(function EditorPane({
  note,
  notes,
  folders,
  onChange,
  onOpenNote
}: EditorPaneProps) {
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const backlinks = useMemo(() => note ? getBacklinks(notes, note.title) : [], [note, notes]);
  const outgoingLinks = useMemo(() => note ? extractWikiLinks(note.content) : [], [note]);

  if (!note) {
    return (
      <main className="editor-pane empty-state">
        <div className="empty-note">
          <span>◇</span>
          <h2>Vault je prázdný</h2>
          <p>Vytvoř první poznámku nebo složku v levém panelu.</p>
        </div>
      </main>
    );
  }

  const updateField = (field: "title" | "content" | "folder", value: string) => {
    onChange({
      ...note,
      [field]: value,
      updatedAt: new Date().toISOString()
    });
  };

  const openWikiLink = (title: string) => {
    const linkedNote = notes.find((candidate) => normalizeTitle(candidate.title) === normalizeTitle(title));

    if (linkedNote) {
      onOpenNote(linkedNote.id);
    }
  };

  const breadcrumbParts = note.folder ? note.folder.split("/") : [];

  return (
    <main className="editor-pane">
      <div className="document-tabbar">
        <div className="document-tab active">
          <span className="tab-icon">▱</span>
          <span>{note.title || "Bez názvu"}</span>
          <small>×</small>
        </div>
        <button type="button" className="tab-add" title="Nová karta" aria-label="Nová karta">＋</button>
      </div>

      <div className="editor-toolbar">
        <div className="breadcrumb">
          <span>Ethical World</span>
          {breadcrumbParts.map((part, index) => (
            <span className="breadcrumb-segment" key={`${part}-${index}`}>
              <b>›</b>
              <span>{part}</span>
            </span>
          ))}
          <b>›</b>
          <strong>{note.title || "Bez názvu"}</strong>
        </div>

        <div className="editor-toolbar-actions">
          <select
            className="folder-select"
            value={note.folder}
            onChange={(event) => updateField("folder", event.target.value)}
            aria-label="Přesunout poznámku do složky"
            title="Přesunout poznámku do složky"
          >
            <option value="">Vault root</option>
            {folders.map((folder) => (
              <option value={folder.path} key={folder.id}>{folder.path}</option>
            ))}
          </select>

          <span className="save-state">uloženo</span>

          <div className="mode-switch">
            <button className={mode === "edit" ? "selected" : ""} type="button" onClick={() => setMode("edit")}>
              Edit
            </button>
            <button className={mode === "preview" ? "selected" : ""} type="button" onClick={() => setMode("preview")}>
              Preview
            </button>
          </div>
        </div>
      </div>

      <div className="document-scroll">
        <div className="document-page">
          <input
            className="title-input"
            value={note.title}
            onChange={(event) => updateField("title", event.target.value)}
            placeholder="Název poznámky"
          />

          <div className="document-meta">
            <span>{note.folder ? `#${note.folder.toLocaleLowerCase("cs-CZ").replaceAll(" ", "-").replaceAll("/", "/")}` : "#root"}</span>
            <span>•</span>
            <span>{new Date(note.updatedAt).toLocaleDateString("cs-CZ")}</span>
          </div>

          {mode === "edit" ? (
            <textarea
              className="note-editor"
              value={note.content}
              onChange={(event) => updateField("content", event.target.value)}
              spellCheck
            />
          ) : (
            <article className="markdown-preview">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{note.content}</ReactMarkdown>
            </article>
          )}

          <section className="relations-panel">
            <div>
              <h3>Outgoing links</h3>
              <div className="chips">
                {outgoingLinks.length === 0 && <span className="muted">Žádné wiki odkazy</span>}
                {outgoingLinks.map((link) => (
                  <button type="button" className="chip" key={link} onClick={() => openWikiLink(link)}>
                    [[{link}]]
                  </button>
                ))}
              </div>
            </div>
            <div>
              <h3>Backlinks</h3>
              <div className="chips">
                {backlinks.length === 0 && <span className="muted">Zatím bez backlinků</span>}
                {backlinks.map((backlink) => (
                  <button type="button" className="chip" key={backlink.id} onClick={() => onOpenNote(backlink.id)}>
                    {backlink.title}
                  </button>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
});
