import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import ForceGraph2D from "react-force-graph-2d";
import {
  buildKnowledgeGraph,
  buildLocalKnowledgeGraph,
  getConnectedNodeIds,
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
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

interface RenderLink {
  source: string | RenderNode;
  target: string | RenderNode;
  kind?: "wiki" | "related";
  score?: number;
}

interface GraphApi {
  zoomToFit: (duration?: number, padding?: number) => void;
  centerAt: (x?: number, y?: number, duration?: number) => void;
  zoom: (scale?: number, duration?: number) => number;
  d3Force: (name: string) => unknown;
  d3ReheatSimulation: () => void;
}

interface StrengthForce {
  strength: (value: number) => unknown;
}

interface LinkForce extends StrengthForce {
  distance: (value: number) => unknown;
}

interface ContextMenuState {
  nodeId: string;
  x: number;
  y: number;
}

const folderPalette = [
  "#8f82ff",
  "#62a6a6",
  "#c19166",
  "#75aa7f",
  "#a979a0",
  "#7892bb",
  "#a69a69"
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

function shortenTitle(title: string): string {
  return title.length > 42 ? `${title.slice(0, 40)}…` : title;
}

export const GraphPane = memo(function GraphPane({
  notes,
  activeNoteId,
  onOpenNote
}: GraphPaneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const graphRef = useRef<GraphApi | null>(null);
  const [scope, setScope] = useState<GraphScope>("global");
  const [localRootId, setLocalRootId] = useState<string | null>(activeNoteId);
  const [query, setQuery] = useState("");
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hiddenNodeIds, setHiddenNodeIds] = useState<Set<string>>(() => new Set());
  const [showLabels, setShowLabels] = useState(true);
  const [showOrphans, setShowOrphans] = useState(true);
  const [colorByFolder, setColorByFolder] = useState(false);
  const [showRelated, setShowRelated] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [stageSize, setStageSize] = useState({ width: 900, height: 620 });

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

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

  useEffect(() => {
    if (activeNoteId && !localRootId) {
      setLocalRootId(activeNoteId);
    }
  }, [activeNoteId, localRootId]);

  const globalGraph = useMemo(
    () => buildKnowledgeGraph(notes, showRelated),
    [notes, showRelated]
  );
  const scopedGraph = useMemo(
    () => scope === "local"
      ? buildLocalKnowledgeGraph(globalGraph, localRootId)
      : globalGraph,
    [globalGraph, localRootId, scope]
  );

  const graphData = useMemo(() => {
    const visibleNodes = scopedGraph.nodes.filter((node) => {
      if (hiddenNodeIds.has(node.id)) return false;
      return showOrphans || node.degree > 0;
    });

    const visibleNodeIds = new Set(visibleNodes.map((node) => node.id));

    return {
      nodes: visibleNodes.map((node) => ({ ...node })),
      links: scopedGraph.links
        .filter((link) => visibleNodeIds.has(link.source) && visibleNodeIds.has(link.target))
        .map((link) => ({ ...link }))
    };
  }, [hiddenNodeIds, scopedGraph, showOrphans]);

  const connectedNodeIds = useMemo(
    () => hoveredNodeId
      ? getConnectedNodeIds(
        {
          nodes: graphData.nodes,
          links: graphData.links.map((link) => ({
            ...link,
            source: linkEndpointId(link.source),
            target: linkEndpointId(link.target)
          }))
        },
        hoveredNodeId
      )
      : new Set<string>(),
    [graphData, hoveredNodeId]
  );

  const normalizedQuery = query.trim().toLocaleLowerCase("cs-CZ");

  const fitGraph = useCallback((duration = 360) => {
    window.requestAnimationFrame(() => {
      const api = graphRef.current;
      const nodeCount = graphData.nodes.length;
      if (!api || nodeCount === 0) return;

      if (nodeCount === 1) {
        const node = graphData.nodes[0] as RenderNode;
        api.centerAt(node.x ?? 0, node.y ?? 0, duration);
        api.zoom(0.9, duration);
        return;
      }

      const padding = nodeCount <= 4 ? 190 : nodeCount <= 12 ? 125 : 90;
      api.zoomToFit(duration, padding);

      window.setTimeout(() => {
        const currentZoom = api.zoom();
        const maxZoom = nodeCount <= 4 ? 1.25 : 1.9;
        if (currentZoom > maxZoom) api.zoom(maxZoom, 160);
      }, duration + 20);
    });
  }, [graphData.nodes]);

  useEffect(() => {
    const api = graphRef.current;
    if (!api) return;

    const chargeForce = api.d3Force("charge") as StrengthForce | undefined;
    const linkForce = api.d3Force("link") as LinkForce | undefined;

    chargeForce?.strength(-78);
    linkForce?.distance(62);
    linkForce?.strength(0.5);
    api.d3ReheatSimulation();
  }, [graphData.links.length, graphData.nodes.length, scope]);

  useEffect(() => {
    const timeout = window.setTimeout(() => fitGraph(320), 180);
    return () => window.clearTimeout(timeout);
  }, [fitGraph, scope, showOrphans, stageSize.height, stageSize.width]);

  const focusNode = useCallback((node: RenderNode) => {
    setSelectedNodeId(node.id);

    if (typeof node.x === "number" && typeof node.y === "number") {
      graphRef.current?.centerAt(node.x, node.y, 240);
      graphRef.current?.zoom(1.45, 240);
    }
  }, []);

  const focusSearchResult = () => {
    if (!normalizedQuery) {
      fitGraph();
      return;
    }

    const node = graphData.nodes.find((candidate) =>
      candidate.title.toLocaleLowerCase("cs-CZ").includes(normalizedQuery)
      || candidate.folder.toLocaleLowerCase("cs-CZ").includes(normalizedQuery)
    );

    if (node) focusNode(node);
  };

  const openLocalGraph = (nodeId: string) => {
    setLocalRootId(nodeId);
    setSelectedNodeId(nodeId);
    setScope("local");
    setContextMenu(null);
  };

  const hideNode = (nodeId: string) => {
    setHiddenNodeIds((current) => {
      const next = new Set(current);
      next.add(nodeId);
      return next;
    });
    setContextMenu(null);
  };

  const copyWikiLink = async (nodeId: string) => {
    const node = globalGraph.nodes.find((candidate) => candidate.id === nodeId);
    if (node) await navigator.clipboard.writeText(`[[${node.title}]]`);
    setContextMenu(null);
  };

  const runNodeAction = async (action: string | null, nodeId: string) => {
    switch (action) {
      case "open":
        onOpenNote(nodeId);
        break;
      case "local":
        openLocalGraph(nodeId);
        break;
      case "copy":
        await copyWikiLink(nodeId);
        break;
      case "hide":
        hideNode(nodeId);
        break;
      default:
        break;
    }
  };

  const showNodeContextMenu = async (node: RenderNode, event: MouseEvent) => {
    setSelectedNodeId(node.id);

    if (window.ethicalDesktop?.isDesktop) {
      setContextMenu(null);
      const action = await window.ethicalDesktop.showContextMenu([
        { id: "open", label: "Otevřít poznámku" },
        { id: "local", label: "Lokální graph" },
        { type: "separator" },
        { id: "copy", label: "Kopírovat wiki link" },
        { id: "hide", label: "Skrýt z grafu" }
      ]);
      await runNodeAction(action, node.id);
      return;
    }

    setContextMenu({
      nodeId: node.id,
      x: Math.min(event.clientX, window.innerWidth - 230),
      y: Math.min(event.clientY, window.innerHeight - 220)
    });
  };

  return (
    <main className="graph-pane obsidian-graph">
      <div
        className="graph-stage obsidian-graph-stage"
        ref={containerRef}
        onContextMenu={(event) => event.preventDefault()}
        onClick={() => setContextMenu(null)}
      >
        <ForceGraph2D
          ref={graphRef as never}
          width={stageSize.width}
          height={stageSize.height}
          graphData={graphData}
          backgroundColor="#1e1e1e"
          nodeRelSize={1}
          nodeVal={() => 1}
          nodeLabel={(rawNode) => {
            const node = rawNode as RenderNode;
            return `${node.title} · ${node.folder || "Vault root"} · ${node.degree} vazeb`;
          }}
          nodeCanvasObject={(rawNode, context, globalScale) => {
            const node = rawNode as RenderNode;
            const x = node.x ?? 0;
            const y = node.y ?? 0;
            const isSelected = node.id === selectedNodeId;
            const isHovered = node.id === hoveredNodeId;
            const isConnected = !hoveredNodeId || connectedNodeIds.has(node.id);
            const matchesQuery = !normalizedQuery
              || node.title.toLocaleLowerCase("cs-CZ").includes(normalizedQuery)
              || node.folder.toLocaleLowerCase("cs-CZ").includes(normalizedQuery);
            const dimmed = !isConnected || !matchesQuery;
            const safeScale = Math.max(globalScale, 0.4);
            const baseRadiusPx = node.degree >= 8 ? 7 : node.degree >= 4 ? 6 : 5;
            const radius = baseRadiusPx / safeScale;
            const nodeColor = colorByFolder
              ? colorForFolder(node.folder || "Vault root")
              : node.degree === 0
                ? "#6f6f6f"
                : "#b7b7b7";

            context.save();
            context.globalAlpha = dimmed ? 0.14 : node.degree === 0 ? 0.7 : 1;

            if (isSelected || isHovered) {
              context.beginPath();
              context.arc(x, y, radius + 2 / safeScale, 0, Math.PI * 2);
              context.strokeStyle = isSelected ? "#9b8cf5" : "#d8d8d8";
              context.lineWidth = 1 / safeScale;
              context.stroke();
            }

            context.beginPath();
            context.arc(x, y, radius, 0, Math.PI * 2);
            context.fillStyle = isSelected ? "#a79af2" : nodeColor;
            context.fill();

            if (showLabels && globalScale >= 0.42) {
              const label = shortenTitle(node.title);
              const fontPx = isSelected ? 16 : 15;
              const fontSize = fontPx / safeScale;
              const labelY = y + radius + 5 / safeScale;

              context.font = `${isSelected ? 520 : 400} ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
              context.textAlign = "center";
              context.textBaseline = "top";
              context.fillStyle = dimmed
                ? "rgba(210,210,210,0.12)"
                : isSelected
                  ? "#e8e5ff"
                  : "#d0d0d0";
              context.fillText(label, x, labelY);
            }

            context.restore();
          }}
          linkColor={(rawLink) => {
            const link = rawLink as unknown as RenderLink;
            const sourceId = linkEndpointId(link.source);
            const targetId = linkEndpointId(link.target);
            const highlighted = sourceId === hoveredNodeId
              || targetId === hoveredNodeId
              || sourceId === selectedNodeId
              || targetId === selectedNodeId;

            if (hoveredNodeId || selectedNodeId) {
              return highlighted
                ? "rgba(126,126,126,0.72)"
                : "rgba(92,92,92,0.10)";
            }

            return link.kind === "related"
              ? "rgba(117,104,154,0.30)"
              : "rgba(118,118,118,0.58)";
          }}
          linkWidth={(rawLink) => {
            const link = rawLink as unknown as RenderLink;
            const sourceId = linkEndpointId(link.source);
            const targetId = linkEndpointId(link.target);
            const highlighted = sourceId === hoveredNodeId
              || targetId === hoveredNodeId
              || sourceId === selectedNodeId
              || targetId === selectedNodeId;
            if (highlighted) return link.kind === "related" ? 0.72 : 1.15;
            return link.kind === "related" ? 0.34 : 0.68;
          }}
          onNodeHover={(rawNode) => setHoveredNodeId(rawNode ? (rawNode as RenderNode).id : null)}
          onNodeClick={(rawNode, event) => {
            event?.stopPropagation?.();
            const node = rawNode as RenderNode;
            focusNode(node);
            const clickCount = (event as MouseEvent | undefined)?.detail ?? 0;
            if (clickCount >= 2) onOpenNote(node.id);
          }}
          onNodeRightClick={(rawNode, event) => {
            event?.preventDefault?.();
            event?.stopPropagation?.();
            void showNodeContextMenu(rawNode as RenderNode, event as MouseEvent);
          }}
          onBackgroundClick={() => {
            setContextMenu(null);
            setSelectedNodeId(null);
          }}
          cooldownTicks={100}
          d3AlphaDecay={0.03}
          d3VelocityDecay={0.38}
          enableNodeDrag
          enablePanInteraction
          enableZoomInteraction
          minZoom={0.25}
          maxZoom={8}
        />

        <div className="obsidian-graph-title">
          {scope === "global" ? "Graf" : "Lokální graf"}
        </div>

        <div className="obsidian-graph-controls">
          <div className="obsidian-search">
            <span>⌕</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") focusSearchResult();
              }}
              placeholder="Hledat…"
            />
          </div>
          <button type="button" onClick={() => fitGraph()} title="Přizpůsobit graf">⊙</button>
          <button
            type="button"
            className={settingsOpen ? "active" : ""}
            onClick={(event) => {
              event.stopPropagation();
              setSettingsOpen((current) => !current);
            }}
            title="Nastavení grafu"
          >
            ⚙
          </button>
        </div>

        {settingsOpen && (
          <div className="obsidian-graph-settings" onClick={(event) => event.stopPropagation()}>
            <div className="obsidian-settings-row">
              <span>Pohled</span>
              <div>
                <button
                  type="button"
                  className={scope === "global" ? "active" : ""}
                  onClick={() => setScope("global")}
                >
                  Global
                </button>
                <button
                  type="button"
                  className={scope === "local" ? "active" : ""}
                  disabled={!localRootId && !activeNoteId}
                  onClick={() => {
                    if (localRootId || activeNoteId) {
                      setLocalRootId(localRootId ?? activeNoteId);
                      setScope("local");
                    }
                  }}
                >
                  Local
                </button>
              </div>
            </div>

            <label><span>Popisky</span><input type="checkbox" checked={showLabels} onChange={() => setShowLabels((current) => !current)} /></label>
            <label><span>Izolované uzly</span><input type="checkbox" checked={showOrphans} onChange={() => setShowOrphans((current) => !current)} /></label>
            <label><span>Barvy podle složek</span><input type="checkbox" checked={colorByFolder} onChange={() => setColorByFolder((current) => !current)} /></label>
            <label><span>Tematické vazby</span><input type="checkbox" checked={showRelated} onChange={() => setShowRelated((current) => !current)} /></label>

            <div className="graph-link-legend">
              <span><i className="wiki-edge" /> wiki link</span>
              <span><i className="related-edge" /> tematická vazba</span>
            </div>

            {hiddenNodeIds.size > 0 && (
              <button className="obsidian-restore-button" type="button" onClick={() => setHiddenNodeIds(new Set())}>
                Obnovit skryté uzly ({hiddenNodeIds.size})
              </button>
            )}
          </div>
        )}

        {graphData.nodes.length === 0 && (
          <div className="obsidian-empty-graph">Žádné poznámky k zobrazení</div>
        )}

        {graphData.nodes.length > 0 && graphData.links.length === 0 && (
          <div className="obsidian-orphan-note">Žádné vazby</div>
        )}

        <div className="obsidian-graph-stats">
          {graphData.nodes.length} uzlů&nbsp;&nbsp;
          {graphData.links.filter((link) => link.kind === "wiki").length} wiki&nbsp;&nbsp;
          {graphData.links.filter((link) => link.kind === "related").length} related
        </div>
      </div>

      {contextMenu && (
        <div
          className="graph-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="graph-context-heading">
            <span>NODE</span>
            <strong>{globalGraph.nodes.find((node) => node.id === contextMenu.nodeId)?.title || "Poznámka"}</strong>
          </div>
          <button type="button" onClick={() => onOpenNote(contextMenu.nodeId)}><span>↗</span>Otevřít poznámku</button>
          <button type="button" onClick={() => openLocalGraph(contextMenu.nodeId)}><span>◎</span>Lokální graf</button>
          <button type="button" onClick={() => void copyWikiLink(contextMenu.nodeId)}><span>[[ ]]</span>Kopírovat wiki link</button>
          <button type="button" onClick={() => hideNode(contextMenu.nodeId)}><span>◌</span>Skrýt z grafu</button>
        </div>
      )}
    </main>
  );
});

export default GraphPane;
