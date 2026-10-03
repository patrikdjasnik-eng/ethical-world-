import { memo, useEffect, useMemo, useRef, useState } from "react";
import ForceGraph2D from "react-force-graph-2d";
import {
  buildKnowledgeGraph,
  buildLocalKnowledgeGraph,
  getConnectedNodeIds,
  type KnowledgeGraphLink,
  type KnowledgeGraphNode
} from "../lib/graph";
import type { Note } from "../types";

interface GraphPaneProps {
  notes: Note[];
  activeNoteId: string | null;
  onOpenNote: (noteId: string) => void;
}

type GraphScope = "global" | "local";

interface RenderNode extends KnowledgeGraphNode {
  x?: number;
  y?: number;
}

interface RenderLink extends KnowledgeGraphLink {
  source: string | RenderNode;
  target: string | RenderNode;
}

const folderPalette = [
  "#8b6cff",
  "#5f9ea0",
  "#b5855b",
  "#6f9f73",
  "#9a6f8f",
  "#7188aa",
  "#9b8b5f"
];

function colorForFolder(folder: string): string {
  let hash = 0;

  for (let index = 0; index < folder.length; index += 1) {
    hash = ((hash << 5) - hash + folder.charCodeAt(index)) | 0;
  }

  return folderPalette[Math.abs(hash) % folderPalette.length];
}

function linkEndpointId(endpoint: string | RenderNode): string {
  return typeof endpoint === "string" ? endpoint : endpoint.id;
}

export const GraphPane = memo(function GraphPane({
  notes,
  activeNoteId,
  onOpenNote
}: GraphPaneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scope, setScope] = useState<GraphScope>("global");
  const [query, setQuery] = useState("");
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [stageSize, setStageSize] = useState({ width: 900, height: 620 });

  useEffect(() => {
    const element = containerRef.current;

    if (!element) {
      return;
    }

    const updateSize = () => {
      const bounds = element.getBoundingClientRect();

      setStageSize({
        width: Math.max(320, Math.floor(bounds.width)),
        height: Math.max(320, Math.floor(bounds.height))
      });
    };

    updateSize();

    const observer = new ResizeObserver(updateSize);
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  const globalGraph = useMemo(() => buildKnowledgeGraph(notes), [notes]);
  const scopedGraph = useMemo(
    () => scope === "local"
      ? buildLocalKnowledgeGraph(globalGraph, activeNoteId)
      : globalGraph,
    [activeNoteId, globalGraph, scope]
  );

  const connectedNodeIds = useMemo(
    () => hoveredNodeId
      ? getConnectedNodeIds(scopedGraph, hoveredNodeId)
      : new Set<string>(),
    [hoveredNodeId, scopedGraph]
  );

  const normalizedQuery = query.trim().toLocaleLowerCase("cs-CZ");
  const folders = useMemo(
    () => Array.from(new Set(scopedGraph.nodes.map((node) => node.folder))).sort(),
    [scopedGraph.nodes]
  );

  const graphData = useMemo(
    () => ({
      nodes: scopedGraph.nodes.map((node) => ({ ...node })),
      links: scopedGraph.links.map((link) => ({ ...link }))
    }),
    [scopedGraph]
  );

  const hasLinks = scopedGraph.links.length > 0;

  return (
    <main className="graph-pane">
      <div className="graph-topbar">
        <div className="graph-title-block">
          <span className="graph-kicker">KNOWLEDGE GRAPH</span>
          <strong>{scope === "global" ? "Celý vault" : "Lokální okolí"}</strong>
          <small>{scopedGraph.nodes.length} uzlů · {scopedGraph.links.length} vazeb</small>
        </div>

        <div className="graph-toolbar">
          <div className="graph-scope-switch">
            <button
              type="button"
              className={scope === "global" ? "selected" : ""}
              onClick={() => setScope("global")}
            >
              Global
            </button>
            <button
              type="button"
              className={scope === "local" ? "selected" : ""}
              onClick={() => setScope("local")}
              disabled={!activeNoteId}
            >
              Local
            </button>
          </div>

          <div className="graph-search">
            <span>⌕</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Najít uzel…"
            />
          </div>
        </div>
      </div>

      <div className="graph-stage" ref={containerRef}>
        <ForceGraph2D
          width={stageSize.width}
          height={stageSize.height}
          graphData={graphData}
          backgroundColor="rgba(0,0,0,0)"
          nodeVal={(rawNode) => 3 + Math.min((rawNode as RenderNode).degree, 8) * 0.75}
          nodeLabel={(rawNode) => {
            const node = rawNode as RenderNode;
            return `${node.title} · ${node.folder} · ${node.degree} vazeb`;
          }}
          nodeCanvasObject={(rawNode, context, globalScale) => {
            const node = rawNode as RenderNode;
            const x = node.x ?? 0;
            const y = node.y ?? 0;
            const isActive = node.id === activeNoteId;
            const isHovered = node.id === hoveredNodeId;
            const isConnected = !hoveredNodeId || connectedNodeIds.has(node.id);
            const matchesQuery = !normalizedQuery
              || node.title.toLocaleLowerCase("cs-CZ").includes(normalizedQuery)
              || node.folder.toLocaleLowerCase("cs-CZ").includes(normalizedQuery);
            const dimmed = !isConnected || !matchesQuery;
            const radius = 4.5 + Math.min(node.degree, 8) * 0.65 + (isActive ? 2 : 0);
            const color = colorForFolder(node.folder);

            context.save();
            context.globalAlpha = dimmed ? 0.16 : 1;

            if (isActive || isHovered) {
              context.beginPath();
              context.arc(x, y, radius + 5, 0, Math.PI * 2);
              context.fillStyle = isActive ? "rgba(141,116,232,0.15)" : "rgba(255,255,255,0.06)";
              context.fill();
            }

            context.beginPath();
            context.arc(x, y, radius, 0, Math.PI * 2);
            context.fillStyle = isActive ? "#a78cff" : color;
            context.fill();

            context.lineWidth = Math.max(0.7, 1.2 / globalScale);
            context.strokeStyle = isHovered || isActive ? "#eee9ff" : "rgba(255,255,255,0.24)";
            context.stroke();

            const fontSize = Math.max(10 / globalScale, 3.5);
            context.font = `${isActive ? 600 : 500} ${fontSize}px Inter, sans-serif`;
            context.textAlign = "center";
            context.textBaseline = "top";
            context.fillStyle = dimmed ? "rgba(210,210,210,0.18)" : isActive ? "#f2edff" : "#c9c9ce";
            context.fillText(node.title, x, y + radius + 3 / globalScale);
            context.restore();
          }}
          linkColor={(rawLink) => {
            const link = rawLink as unknown as RenderLink;

            if (!hoveredNodeId) {
              return "rgba(150,150,160,0.16)";
            }

            const sourceId = linkEndpointId(link.source);
            const targetId = linkEndpointId(link.target);
            const highlighted = sourceId === hoveredNodeId || targetId === hoveredNodeId;
            return highlighted ? "rgba(167,140,255,0.74)" : "rgba(130,130,140,0.05)";
          }}
          linkWidth={(rawLink) => {
            const link = rawLink as unknown as RenderLink;

            if (!hoveredNodeId) {
              return 0.7;
            }

            const sourceId = linkEndpointId(link.source);
            const targetId = linkEndpointId(link.target);
            return sourceId === hoveredNodeId || targetId === hoveredNodeId ? 1.6 : 0.35;
          }}
          onNodeHover={(rawNode) => setHoveredNodeId(rawNode ? (rawNode as RenderNode).id : null)}
          onNodeClick={(rawNode) => onOpenNote((rawNode as RenderNode).id)}
          cooldownTicks={90}
          d3AlphaDecay={0.035}
          d3VelocityDecay={0.28}
          enableNodeDrag
          enablePanInteraction
          enableZoomInteraction
          minZoom={0.35}
          maxZoom={7}
        />

        {!hasLinks && (
          <div className="graph-empty-overlay">
            <span className="graph-empty-orbit"><i /><i /><i /></span>
            <strong>Graph začne růst s tvými odkazy</strong>
            <p>
              Propoj poznámky syntaxí <code>[[Název poznámky]]</code> a vztahy se objeví automaticky.
            </p>
            <small>Tip: otevři poznámku a přidej první wiki link.</small>
          </div>
        )}

        <div className="graph-help">drag · zoom · kliknutím otevřeš poznámku</div>
      </div>

      <div className="graph-statusbar">
        <div className="graph-stats">
          <span><strong>{scopedGraph.nodes.length}</strong> uzlů</span>
          <span><strong>{scopedGraph.links.length}</strong> vazeb</span>
          <span><strong>{folders.length}</strong> skupin</span>
        </div>

        <div className="graph-legend">
          {folders.slice(0, 5).map((folder) => (
            <span key={folder}>
              <i style={{ background: colorForFolder(folder) }} />
              {folder}
            </span>
          ))}
          {folders.length > 5 && <span>+{folders.length - 5}</span>}
        </div>
      </div>
    </main>
  );
});

export default GraphPane;
