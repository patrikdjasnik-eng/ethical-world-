import { isValidElement, memo, useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { InsertMenu } from "./InsertMenu";
import { MermaidDiagram } from "./MermaidDiagram";
import { applyMarkdownInsert, type MarkdownInsertRequest } from "../lib/editorInsert";
import { extractWikiLinks, getBacklinks, normalizeTitle } from "../lib/notes";
import { listCarrotCommits } from "../lib/storage";
import { verifyCarrotHistory } from "../lib/carrot";
import { mermaidSourceFromCode } from "../lib/mermaid";
import type { CarrotCommit, Note, VaultFolder } from "../types";

function mermaidSourceFromMarkdownNode(children: ReactNode): string | null {
  if (!isValidElement<{ className?: string; children?: ReactNode }>(children)) return null;

  const source = children.props.children;
  const value = Array.isArray(source) ? source.join("") : String(source ?? "");
  return mermaidSourceFromCode(children.props.className, value);
}

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
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [carrotOpen, setCarrotOpen] = useState(false);
  const [carrotCommits, setCarrotCommits] = useState<CarrotCommit[]>([]);
  const [carrotSelectedId, setCarrotSelectedId] = useState<string | null>(null);
  const [carrotVerified, setCarrotVerified] = useState<Record<string, boolean | null>>({});
  const [carrotLoading, setCarrotLoading] = useState(false);
  const [carrotPosition, setCarrotPosition] = useState<{ x: number; y: number } | null>(null);
  const carrotPanelRef = useRef<HTMLElement | null>(null);
  const carrotDragOffsetRef = useRef<{ x: number; y: number } | null>(null);
  const backlinks = useMemo(() => note ? getBacklinks(notes, note.title) : [], [note, notes]);
  const outgoingLinks = useMemo(() => note ? extractWikiLinks(note.content) : [], [note]);

  const loadCarrotHistory = useCallback(async () => {
    if (!note) return;

    setCarrotLoading(true);
    try {
      const commits = await listCarrotCommits(note.id);
      setCarrotCommits(commits);
      setCarrotSelectedId((current) =>
        current && commits.some((commit) => commit.id === current)
          ? current
          : commits[0]?.id ?? null
      );

      setCarrotVerified(await verifyCarrotHistory(commits));
    } finally {
      setCarrotLoading(false);
    }
  }, [note?.id]);

  useEffect(() => {
    setCarrotOpen(false);
    setCarrotCommits([]);
    setCarrotSelectedId(null);
    setCarrotVerified({});
    setCarrotPosition(null);
  }, [note?.id]);

  const beginCarrotDrag = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    if ((event.target as HTMLElement).closest("button")) return;

    const panel = carrotPanelRef.current;
    if (!panel) return;

    const rect = panel.getBoundingClientRect();
    carrotDragOffsetRef.current = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
    setCarrotPosition({ x: rect.left, y: rect.top });

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const offset = carrotDragOffsetRef.current;
      const currentPanel = carrotPanelRef.current;
      if (!offset || !currentPanel) return;

      const width = currentPanel.offsetWidth;
      const height = currentPanel.offsetHeight;
      const minX = 54;
      const minY = 46;
      const maxX = Math.max(minX, window.innerWidth - width - 8);
      const maxY = Math.max(minY, window.innerHeight - height - 8);

      setCarrotPosition({
        x: Math.min(maxX, Math.max(minX, moveEvent.clientX - offset.x)),
        y: Math.min(maxY, Math.max(minY, moveEvent.clientY - offset.y))
      });
    };

    const handlePointerUp = () => {
      carrotDragOffsetRef.current = null;
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  }, []);

  const selectedCarrotCommit = useMemo(
    () => carrotCommits.find((commit) => commit.id === carrotSelectedId) ?? null,
    [carrotCommits, carrotSelectedId]
  );

  if (!note) {
    return (
      <main className="editor-pane empty-state">
        <div className="empty-note"><span>◇</span><h2>Vault je prázdný</h2><p>Vytvoř první poznámku nebo složku v levém panelu.</p></div>
      </main>
    );
  }

  const updateField = (field: "title" | "content" | "folder", value: string) => {
    onChange({ ...note, [field]: value, updatedAt: new Date().toISOString() });
  };

  const openWikiLink = (title: string) => {
    const linkedNote = notes.find((candidate) => normalizeTitle(candidate.title) === normalizeTitle(title));
    if (linkedNote) onOpenNote(linkedNote.id);
  };

  const insertMarkdown = (request: MarkdownInsertRequest) => {
    const editor = textareaRef.current;
    const selectionStart = editor?.selectionStart ?? note.content.length;
    const selectionEnd = editor?.selectionEnd ?? note.content.length;
    const result = applyMarkdownInsert(note.content, selectionStart, selectionEnd, request);

    setMode("edit");
    updateField("content", result.content);

    window.requestAnimationFrame(() => {
      const nextEditor = textareaRef.current;
      if (!nextEditor) return;
      nextEditor.focus();
      nextEditor.setSelectionRange(result.selectionStart, result.selectionEnd);
    });
  };

  const breadcrumbParts = note.folder ? note.folder.split("/") : [];

  return (
    <main className="editor-pane">
      <div className="document-tabbar">
        <div className="document-tab active"><span className="tab-icon">▱</span><span>{note.title || "Bez názvu"}</span><small>×</small></div>
        <button type="button" className="tab-add" title="Nová karta" aria-label="Nová karta">＋</button>
      </div>

      <div className="editor-toolbar">
        <div className="breadcrumb">
          <span>Ethical World</span>
          {breadcrumbParts.map((part, index) => (
            <span className="breadcrumb-segment" key={`${part}-${index}`}><b>›</b><span>{part}</span></span>
          ))}
          <b>›</b><strong>{note.title || "Bez názvu"}</strong>
        </div>

        <div className="editor-toolbar-actions">
          <select className="folder-select" value={note.folder} onChange={(event) => updateField("folder", event.target.value)} aria-label="Přesunout poznámku do složky" title="Přesunout poznámku do složky">
            <option value="">Vault root</option>
            {folders.map((folder) => <option value={folder.path} key={folder.id}>{folder.path}</option>)}
          </select>
          <span className="save-state">uloženo</span>
          <button
            type="button"
            className={"carrot-toggle " + (carrotOpen ? "active" : "")}
            onClick={() => {
              const next = !carrotOpen;
              setCarrotOpen(next);
              if (next) void loadCarrotHistory();
            }}
            title="Carrot historie Markdownu"
          >
            🥕 Carrot
          </button>
          <div className="mode-switch">
            <button className={mode === "edit" ? "selected" : ""} type="button" onClick={() => setMode("edit")}>Edit</button>
            <button className={mode === "preview" ? "selected" : ""} type="button" onClick={() => setMode("preview")}>Preview</button>
          </div>
        </div>
      </div>

      <div className="document-scroll">
        <div className="document-page">
          <input className="title-input" value={note.title} onChange={(event) => updateField("title", event.target.value)} placeholder="Název poznámky" />
          <div className="document-meta">
            <span>{note.folder ? `#${note.folder.toLocaleLowerCase("cs-CZ").replaceAll(" ", "-")}` : "#root"}</span>
            <span>•</span><span>{new Date(note.updatedAt).toLocaleDateString("cs-CZ")}</span>
            <span>•</span><span>{outgoingLinks.length} links</span>
          </div>

          <InsertMenu notes={notes} currentNoteId={note.id} onInsert={insertMarkdown} />

          {mode === "edit" ? (
            <textarea ref={textareaRef} className="note-editor" value={note.content} onChange={(event) => updateField("content", event.target.value)} spellCheck />
          ) : (
            <article className="markdown-preview">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  pre({ children }) {
                    const source = mermaidSourceFromMarkdownNode(children);
                    return source
                      ? <MermaidDiagram source={source} />
                      : <pre>{children}</pre>;
                  }
                }}
              >
                {note.content}
              </ReactMarkdown>
            </article>
          )}

          {carrotOpen && (
            <section
              ref={carrotPanelRef}
              className="carrot-history carrot-floating"
              style={carrotPosition
                ? { left: carrotPosition.x, top: carrotPosition.y, right: "auto", bottom: "auto" }
                : undefined}
            >
              <div className="carrot-history-head carrot-drag-handle" onPointerDown={beginCarrotDrag}>
                <div>
                  <span>🥕 CARROT HISTORY</span>
                  <strong>{carrotCommits.length} commitů</strong>
                  <small>chyť a přesuň</small>
                </div>

                <div className="carrot-window-actions">
                  <button type="button" onClick={() => void loadCarrotHistory()} disabled={carrotLoading}>
                    {carrotLoading ? "Načítám…" : "Obnovit"}
                  </button>
                  <button type="button" onClick={() => setCarrotPosition(null)} title="Vrátit výchozí pozici">
                    Reset
                  </button>
                  <button type="button" onClick={() => setCarrotOpen(false)} title="Zavřít Carrot">
                    ×
                  </button>
                </div>
              </div>

              {carrotCommits.length === 0 ? (
                <p className="carrot-empty">Pro tuto poznámku zatím není žádný Carrot commit.</p>
              ) : (
                <div className="carrot-grid">
                  <div className="carrot-list">
                    {carrotCommits.map((commit) => {
                      const verified = carrotVerified[commit.id];
                      return (
                        <button
                          type="button"
                          className={commit.id === carrotSelectedId ? "active" : ""}
                          key={commit.id}
                          onClick={() => setCarrotSelectedId(commit.id)}
                        >
                          <span>{commit.message}</span>
                          <strong>{commit.authorDisplayName}</strong>
                          <small>
                            {new Date(commit.createdAt).toLocaleString("cs-CZ")} · {commit.commitHash.slice(0, 8)}
                          </small>
                          <i>
                            {commit.signatureAlgorithm === "Ed25519"
                              ? verified === true
                                ? "✓ podpis ověřen"
                                : verified === false
                                  ? "⚠ podpis nesedí"
                                  : "podpis · " + (commit.keyId ?? "unknown")
                              : "browser · bez podpisu"}
                          </i>
                        </button>
                      );
                    })}
                  </div>

                  {selectedCarrotCommit && (
                    <div className="carrot-preview">
                      <div className="carrot-preview-meta">
                        <span>commit {selectedCarrotCommit.id.slice(0, 8)}</span>
                        <span>parent {selectedCarrotCommit.parentId?.slice(0, 8) ?? "root"}</span>
                        <span>chain {selectedCarrotCommit.parentCommitHash?.slice(0, 8) ?? "root"}</span>
                        <span>key {selectedCarrotCommit.keyId ?? "unsigned"}</span>
                      </div>
                      <h3>{selectedCarrotCommit.title}</h3>
                      <pre>{selectedCarrotCommit.content}</pre>
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          <section className="relations-panel">
            <div><h3>Outgoing links</h3><div className="chips">
              {outgoingLinks.length === 0 && <span className="muted">Žádné wiki odkazy</span>}
              {outgoingLinks.map((link) => <button type="button" className="chip" key={link} onClick={() => openWikiLink(link)}>[[{link}]]</button>)}
            </div></div>
            <div><h3>Backlinks</h3><div className="chips">
              {backlinks.length === 0 && <span className="muted">Zatím bez backlinků</span>}
              {backlinks.map((backlink) => <button type="button" className="chip" key={backlink.id} onClick={() => onOpenNote(backlink.id)}>{backlink.title}</button>)}
            </div></div>
          </section>
        </div>
      </div>
    </main>
  );
});
