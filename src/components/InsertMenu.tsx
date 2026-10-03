import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { MarkdownInsertRequest } from "../lib/editorInsert";
import type { Note } from "../types";

interface InsertMenuProps {
  notes: Note[];
  currentNoteId: string;
  onInsert: (request: MarkdownInsertRequest) => void;
}

type InsertPanel = "main" | "links" | "code" | "callout";

const codeLanguages = [
  ["bash", "Bash"],
  ["powershell", "PowerShell"],
  ["python", "Python"],
  ["typescript", "TypeScript"],
  ["javascript", "JavaScript"],
  ["json", "JSON"],
  ["sql", "SQL"],
  ["yaml", "YAML"],
  ["cpp", "C++"],
  ["dockerfile", "Dockerfile"]
] as const;

const callouts = [
  ["NOTE", "Poznámka"],
  ["TIP", "Tip"],
  ["WARNING", "Varování"],
  ["INFO", "Info"]
] as const;

export const InsertMenu = memo(function InsertMenu({
  notes,
  currentNoteId,
  onInsert
}: InsertMenuProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [panel, setPanel] = useState<InsertPanel | null>(null);
  const [linkQuery, setLinkQuery] = useState("");

  const linkNotes = useMemo(() => {
    const normalized = linkQuery.trim().toLocaleLowerCase("cs-CZ");

    return notes
      .filter((note) => note.id !== currentNoteId)
      .filter((note) => !normalized
        || note.title.toLocaleLowerCase("cs-CZ").includes(normalized)
        || note.folder.toLocaleLowerCase("cs-CZ").includes(normalized))
      .sort((left, right) => left.title.localeCompare(right.title, "cs"));
  }, [currentNoteId, linkQuery, notes]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setPanel(null);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  const insertAndClose = (request: MarkdownInsertRequest) => {
    onInsert(request);
    setPanel(null);
    setLinkQuery("");
  };

  return (
    <div className="insert-menu-shell" ref={rootRef}>
      <div className="document-insertbar">
        <button className={panel === "main" ? "active" : ""} type="button" onClick={() => setPanel((current) => current === "main" ? null : "main")}>
          <span>＋</span> Insert
        </button>
        <button className={panel === "links" ? "active" : ""} type="button" onClick={() => setPanel((current) => current === "links" ? null : "links")}>
          <span>[[ ]]</span> Link
        </button>
        <button className={panel === "code" ? "active" : ""} type="button" onClick={() => setPanel((current) => current === "code" ? null : "code")}>
          <span>{"</>"}</span> Code
        </button>
        <button type="button" onClick={() => insertAndClose({ kind: "task" })}>
          <span>☐</span> Task
        </button>
        <button className={panel === "callout" ? "active" : ""} type="button" onClick={() => setPanel((current) => current === "callout" ? null : "callout")}>
          <span>◈</span> Callout
        </button>
      </div>

      {panel && (
        <div className="insert-popover">
          {panel === "main" && (
            <>
              <div className="insert-popover-heading">
                <div><span>MARKDOWN</span><strong>Vložit blok</strong></div>
                <small>bez psaní syntaxe</small>
              </div>
              <div className="insert-action-grid">
                <button type="button" onClick={() => setPanel("links")}><span className="insert-action-icon">↗</span><div><strong>Odkaz na poznámku</strong><small>Vyber existující note</small></div></button>
                <button type="button" onClick={() => setPanel("code")}><span className="insert-action-icon">{"</>"}</span><div><strong>Code block</strong><small>Bash, Python, TS…</small></div></button>
                <button type="button" onClick={() => insertAndClose({ kind: "heading", level: 2 })}><span className="insert-action-icon">H2</span><div><strong>Nadpis</strong><small>Heading level 2</small></div></button>
                <button type="button" onClick={() => insertAndClose({ kind: "table" })}><span className="insert-action-icon">▦</span><div><strong>Tabulka</strong><small>2 × 2 Markdown</small></div></button>
                <button type="button" onClick={() => insertAndClose({ kind: "quote" })}><span className="insert-action-icon">”</span><div><strong>Citace</strong><small>Quote block</small></div></button>
                <button type="button" onClick={() => insertAndClose({ kind: "inline-code" })}><span className="insert-action-icon">IC</span><div><strong>Inline code</strong><small>Kód v textu</small></div></button>
                <button type="button" onClick={() => setPanel("callout")}><span className="insert-action-icon">◈</span><div><strong>Callout</strong><small>Note, tip, warning…</small></div></button>
                <button type="button" onClick={() => insertAndClose({ kind: "divider" })}><span className="insert-action-icon">―</span><div><strong>Oddělovač</strong><small>Horizontal rule</small></div></button>
              </div>
            </>
          )}

          {panel === "links" && (
            <>
              <div className="insert-popover-heading">
                <div><span>WIKI LINK</span><strong>Propojit s poznámkou</strong></div>
                <small>{linkNotes.length} možností</small>
              </div>
              <div className="insert-search"><span>⌕</span><input autoFocus value={linkQuery} onChange={(event) => setLinkQuery(event.target.value)} placeholder="Najít poznámku…" /></div>
              <div className="insert-note-list">
                {linkNotes.slice(0, 24).map((note) => (
                  <button type="button" key={note.id} onClick={() => insertAndClose({ kind: "wiki-link", title: note.title })}>
                    <span className="insert-note-icon">▱</span>
                    <div><strong>{note.title || "Bez názvu"}</strong><small>{note.folder || "Vault root"}</small></div>
                    <span className="insert-note-arrow">↵</span>
                  </button>
                ))}
                {linkNotes.length === 0 && <div className="insert-empty">Žádná další poznámka neodpovídá hledání.</div>}
              </div>
            </>
          )}

          {panel === "code" && (
            <>
              <div className="insert-popover-heading"><div><span>CODE BLOCK</span><strong>Vyber jazyk</strong></div><small>Markdown fence</small></div>
              <div className="insert-language-grid">
                {codeLanguages.map(([language, label]) => (
                  <button type="button" key={language} onClick={() => insertAndClose({ kind: "code", language })}>
                    <span>{language === "powershell" ? "PS" : language.slice(0, 2).toUpperCase()}</span>
                    {label}
                  </button>
                ))}
              </div>
            </>
          )}

          {panel === "callout" && (
            <>
              <div className="insert-popover-heading"><div><span>CALLOUT</span><strong>Typ bloku</strong></div><small>vizuální zvýraznění</small></div>
              <div className="insert-language-grid">
                {callouts.map(([calloutType, label]) => (
                  <button type="button" key={calloutType} onClick={() => insertAndClose({ kind: "callout", calloutType })}>
                    <span>◈</span>{label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
});

export default InsertMenu;
