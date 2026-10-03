import { memo } from "react";
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
  return (
    <nav className="activity-rail" aria-label="Hlavní navigace">
      <div className="activity-rail-top">
        <button
          type="button"
          className={sidebarOpen ? "active" : ""}
          onClick={onToggleSidebar}
          title="Files (Ctrl+B)"
          aria-label="Files"
        >
          <span className="rail-glyph">▤</span>
        </button>

        <button
          type="button"
          className={view === "note" ? "active" : ""}
          onClick={() => onViewChange("note")}
          title="Poznámky"
          aria-label="Poznámky"
        >
          <span className="rail-glyph">▱</span>
        </button>

        <button
          type="button"
          className={view === "graph" ? "active" : ""}
          onClick={() => onViewChange("graph")}
          title="Knowledge graph"
          aria-label="Knowledge graph"
        >
          <span className="rail-glyph">⌘</span>
        </button>

        <button
          type="button"
          className={view === "connectors" ? "active" : ""}
          onClick={() => onViewChange("connectors")}
          title="Connectors"
          aria-label="Connectors"
        >
          <span className="rail-glyph">⇄</span>
        </button>

        <button type="button" title="Hledání" aria-label="Hledání">
          <span className="rail-glyph">⌕</span>
        </button>
      </div>

      <div className="activity-rail-bottom">
        <button
          type="button"
          className={aiOpen ? "active" : ""}
          onClick={onToggleAi}
          title="Máša (Ctrl+J)"
          aria-label="Máša"
        >
          <span className="rail-glyph rail-ai">M</span>
        </button>

        <button type="button" title="Nastavení" aria-label="Nastavení">
          <span className="rail-glyph">⚙</span>
        </button>
      </div>
    </nav>
  );
});

export default ActivityRail;
