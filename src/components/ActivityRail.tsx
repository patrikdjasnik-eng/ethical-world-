import { memo, useState } from "react";
import type { WorkspaceView } from "./VaultSidebar";

interface ActivityRailProps {
  view: WorkspaceView;
  sidebarOpen: boolean;
  aiOpen: boolean;
  onViewChange: (view: WorkspaceView) => void;
  onToggleSidebar: () => void;
  onToggleAi: () => void;
}

export const ActivityRail = memo(function ActivityRail({
  view,
  sidebarOpen,
  aiOpen,
  onViewChange,
  onToggleSidebar,
  onToggleAi
}: ActivityRailProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const openView = (nextView: WorkspaceView) => {
    onViewChange(nextView);
    setMoreOpen(false);
  };

  return (
    <>
      {moreOpen && <button type="button" className="activity-more-backdrop" aria-label="Zavřít nabídku" onClick={() => setMoreOpen(false)} />}
      <nav className="activity-rail" aria-label="Hlavní navigace">
      <div className="activity-rail-top">
        <button type="button" className={sidebarOpen ? "active" : ""} onClick={() => { onToggleSidebar(); setMoreOpen(false); }} title="Soubory" aria-label="Files" aria-expanded={sidebarOpen}>
          <span className="rail-glyph">▤</span>
        </button>
        <button type="button" className={view === "note" ? "active" : ""} onClick={() => openView("note")} title="Poznámky" aria-label="Poznámky">
          <span className="rail-glyph">▱</span>
        </button>
        <button type="button" className={view === "graph" ? "active" : ""} onClick={() => openView("graph")} title="Knowledge graph" aria-label="Knowledge graph">
          <span className="rail-glyph">⌘</span>
        </button>
        <button type="button" className={view === "connectors" ? "active" : ""} onClick={() => openView("connectors")} title="Connectors" aria-label="Connectors">
          <span className="rail-glyph">⇄</span>
        </button>
        <button type="button" className={view === "guide" ? "active" : ""} onClick={() => openView("guide")} title="Návod" aria-label="Guide / Návod">
          <span className="rail-glyph">?</span>
        </button>
        <button
          type="button"
          className={"activity-rail-more " + (moreOpen || view === "connectors" || view === "guide" || view === "account" ? "active" : "")}
          onClick={() => setMoreOpen((current) => !current)}
          title="Další sekce"
          aria-label="Více"
          aria-expanded={moreOpen}
        >
          <span className="rail-glyph">•••</span>
        </button>
        {moreOpen && (
          <div className="activity-more-menu" role="menu" aria-label="Další sekce">
            <button type="button" role="menuitem" onClick={() => openView("connectors")}><span>⇄</span><strong>Konektory</strong></button>
            <button type="button" role="menuitem" onClick={() => openView("guide")}><span>?</span><strong>Nápověda</strong></button>
            <button type="button" role="menuitem" onClick={() => openView("account")}><span>⚙</span><strong>Účet a nastavení</strong></button>
          </div>
        )}
      </div>
      <div className="activity-rail-bottom">
        <button type="button" className={aiOpen ? "active" : ""} onClick={() => { onToggleAi(); setMoreOpen(false); }} title="Máša" aria-label="Máša" aria-expanded={aiOpen}>
          <span className="rail-glyph rail-ai">M</span>
        </button>
        <button type="button" className={view === "account" ? "active" : ""} onClick={() => openView("account")} title="Účet a nastavení" aria-label="Účet a nastavení">
          <span className="rail-glyph">⚙</span>
        </button>
      </div>
      </nav>
    </>
  );
});

export default ActivityRail;
