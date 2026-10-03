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
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

interface RenderLink extends KnowledgeGraphLink {
  source: string | RenderNode;
  target: string | RenderNode;
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
  return title.length > 34 ? `${title.slice(0, 32)}…` : title;
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
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(activeNoteId);
  const [hiddenNodeIds, setHiddenNodeIds] = useState<Set<string>>(() => new Set());
  const [showLabels, setShowLabels] = useState(true);
  const [showOrphans, setShowOrphans] = useState(true);
  const [colorByFolder, setColorByFolder] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
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

  useEffect(() => {
    if (activeNoteId) {
      setSelectedNodeId(activeNoteId);

      if (!localRootId) {
        setLocalRootId(activeNoteId);
      }
    }
  }, [activeNoteId, localRootId]);

  const globalGraph = useMemo(() => buildKnowledgeGraph(notes), [notes]);
  const scopedGraph = useMemo(
    () => scope === "local"
      ? buildLocalKnowledgeGraph(globalGraph, localRootId)
      : globalGraph,
    [globalGraph, localRootId, scope]
  );

  const graphData = useMemo(() => {
    const visibleNodes = scopedGraph.nodes.filter((node) => {
      if (hiddenNodeIds.has(node.id)) {
        return false;
      }

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
            source: link.source,
            target: link.target
          }))
        },
        hoveredNodeId
      )
      : new Set<string>(),
    [graphData, hoveredNodeId]
  );

  const normalizedQuery = query.trim().toLocaleLowerCase("cs-CZ");
  const folders = useMemo(
    () => Array.from(new Set(graphData.nodes.map((node) => node.folder))).sort(),
    [graphData.nodes]
  );

  const selectedNode = useMemo(
    () => graphData.nodes.find((node) => node.id === selectedNodeId) ?? null,
    [graphData.nodes, selectedNodeId]
  );

  const fitGraph = useCallback((duration = 450) => {
    window.requestAnimationFrame(() => {
      graphRef.current?.zoomToFit(duration, 72);
    });
  }, []);

  useEffect(() => {
    const api = graphRef.current;

    if (!api) {
      return;
    }

    const chargeForce = api.d3Force("charge") as StrengthForce | undefined;
    const linkForce = api.d3Force("link") as LinkForce | undefined;

    chargeForce?.strength(-105);
    linkForce?.distance(72);
    linkForce?.strength(0.42);
    api.d3ReheatSimulation();
  }, [graphData.links.length, graphData.nodes.length, scope]);

  useEffect(() => {
    const timeout = window.setTimeout(() => fitGraph(300), 120);
    return () => window.clearTimeout(timeout);
  }, [fitGraph, scope, showOrphans, stageSize.height, stageSize.width]);

  const focusNode = useCallback((node: RenderNode) => {
    setSelectedNodeId(node.id);

    if (typeof node.x === "number" && typeof node.y === "number") {
      graphRef.current?.centerAt(node.x, node.y, 320);
      graphRef.current?.zoom(2.05, 320);
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

    if (node) {
      focusNode(node);
    }
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

    if (node) {
      await navigator.clipboard.writeText(`[[${node.title}]]`);
    }

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
    <main className="graph-pane">
      <div className="graph-topbar">
        <div className="graph-title-block">
          <span className="graph-kicker">KNOWLEDGE GRAPH</span>
          <strong>{scope === "global" ? "Celý vault" : "Lokální okolí"}</strong>
          <small>{graphData.nodes.length} uzlů · {graphData.links.length} vazeb</small>
        </div>

        <div className="graph-toolbar">
          <div className="graph-scope-switch">
            <button
              type="button"
              className={scope === "global" ? "selected" : ""}
              onClick={() => {
                setScope("global");
                setContextMenu(null);
              }}
            >
              Global
            </button>
            <button
              type="button"
              className={scope === "local" ? "selected" : ""}
              onClick={() => {
                if (localRootId || activeNoteId) {
                  setLocalRootId(localRootId ?? activeNoteId);
                  setScope("local");
                }
              }}
              disabled={!localRootId && !activeNoteId}
            >
              Local
            </button>
          </div>

          <div className="graph-search">
            <span>⌕</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  focusSearchResult();
                }
              }}
              placeholder="Najít uzel…"
            />
          </div>

          <button className="graph-fit-button" type="button" onClick={() => fitGraph()}>
            Fit
          </button>
        </div>
      </div>

      <div
        className="graph-stage"
        ref={containerRef}
        onContextMenu={(event) => event.preventDefault()}
        onClick={() => setContextMenu(null)}
      >
        <ForceGraph2D
          ref={graphRef as never}
          width={stageSize.width}
          height={stageSize.height}
          graphData={graphData}
          backgroundColor="rgba(0,0,0,0)"
          nodeRelSize={4}
          nodeVal={(rawNode) => 1.2 + Math.min((rawNode as RenderNode).degree, 10) * 0.34}
          nodeLabel={(rawNode) => {
            const node = rawNode as RenderNode;
            return `${node.title} · ${node.folder || "Vault root"} · ${node.degree} vazeb`;
          }}
          nodeCanvasObject={(rawNode, context, globalScale) => {
            const node = rawNode as RenderNode;
            const x = node.x ?? 0;
            const y = node.y ?? 0;
            const isActive = node.id === activeNoteId;
            const isSelected = node.id === selectedNodeId;
            const isHovered = node.id === hoveredNodeId;
            const isConnected = !hoveredNodeId || connectedNodeIds.has(node.id);
            const matchesQuery = !normalizedQuery
              || node.title.toLocaleLowerCase("cs-CZ").includes(normalizedQuery)
              || node.folder.toLocaleLowerCase("cs-CZ").includes(normalizedQuery);
            const dimmed = !isConnected || !matchesQuery;
            const radius = 3.7 + Math.min(node.degree, 10) * 0.42 + (isSelected ? 1.1 : 0);
            const nodeColor = colorByFolder
              ? colorForFolder(node.folder || "Vault root")
              : node.degree === 0
                ? "#73737d"
                : "#b8b8c1";

            context.save();
            context.globalAlpha = dimmed ? 0.13 : node.degree === 0 ? 0.62 : 1;

            if (isSelected || isHovered) {
              context.beginPath();
              context.arc(x, y, radius + 4.2, 0, Math.PI * 2);
              context.fillStyle = isSelected
                ? "rgba(139,124,246,0.16)"
                : "rgba(255,255,255,0.055)";
              context.fill();
            }

            context.beginPath();
            context.arc(x, y, radius, 0, Math.PI * 2);
            context.fillStyle = isSelected ? "#9a89ff" : nodeColor;
            context.fill();

            context.lineWidth = Math.max(0.7, 1.1 / globalScale);
            context.strokeStyle = isActive
              ? "#d7d0ff"
              : isHovered
                ? "#f0f0f5"
                : "rgba(255,255,255,0.24)";
            context.stroke();

            if (showLabels && globalScale > 0.52) {
              const label = shortenTitle(node.title);
              const fontSize = Math.max(11.5 / globalScale, 3.7);
              context.font = `${isSelected ? 620 : 500} ${fontSize}px Inter, sans-serif`;
              context.textAlign = "center";
              context.textBaseline = "top";

              const labelY = y + radius + 3 / globalScale;
              const textWidth = context.measureText(label).width;
              const padX = 3 / globalScale;
              const padY = 1.8 / globalScale;

              context.fillStyle = dimmed
                ? "rgba(13,13,17,0.15)"
                : "rgba(13,13,17,0.72)";
              context.fillRect(
                x - textWidth / 2 - padX,
                labelY - padY,
                textWidth + padX * 2,
                fontSize + padY * 2
              );

              context.fillStyle = dimmed
                ? "rgba(215,215,222,0.16)"
                : isSelected
                  ? "#f2efff"
                  : "#d1d1d7";
              context.fillText(label, x, labelY);
            }

            context.restore();
          }}
          linkColor={(rawLink) => {
            const link = rawLink as unknown as RenderLink;

            if (!hoveredNodeId && !selectedNodeId) {
              return "rgba(155,155,168,0.19)";
            }

            const sourceId = linkEndpointId(link.source);
            const targetId = linkEndpointId(link.target);
            const highlighted = sourceId === hoveredNodeId
              || targetId === hoveredNodeId
              || sourceId === selectedNodeId
              || targetId === selectedNodeId;

            return highlighted
              ? "rgba(154,137,255,0.72)"
              : "rgba(130,130,142,0.055)";
          }}
          linkWidth={(rawLink) => {
            const link = rawLink as unknown as RenderLink;
            const sourceId = linkEndpointId(link.source);
            const targetId = linkEndpointId(link.target);
            const highlighted = sourceId === hoveredNodeId
              || targetId === hoveredNodeId
              || sourceId === selectedNodeId
              || targetId === selectedNodeId;

            return highlighted ? 1.45 : 0.72;
          }}
          onNodeHover={(rawNode) => setHoveredNodeId(rawNode ? (rawNode as RenderNode).id : null)}
          onNodeClick={(rawNode, event) => {
            event?.stopPropagation?.();
            const node = rawNode as RenderNode;
            focusNode(node);

            if ((event as MouseEvent | undefined)?.detail >= 2) {
              onOpenNote(node.id);
            }
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
          onEngineStop={() => fitGraph(420)}
          cooldownTicks={120}
          d3AlphaDecay={0.025}
          d3VelocityDecay={0.34}
          enableNodeDrag
          enablePanInteraction
          enableZoomInteraction
          minZoom={0.24}
          maxZoom={8}
        />

        {graphData.nodes.length === 0 && (
          <div className="graph-empty-overlay">
            <span className="graph-empty-orbit"><i /><i /><i /></span>
            <strong>Graph čeká na první poznámku</strong>
            <p>Vytvoř poznámku nebo znovu zapni skryté uzly.</p>
          </div>
        )}

        {graphData.nodes.length > 0 && graphData.links.length === 0 && (
          <div className="graph-orphan-hint">
            Žádné vazby · vlož <code>[[odkaz]]</code> nebo použij Link v editoru
          </div>
        )}

        <div className="graph-floating-tools">
          <button
            type="button"
            className={showLabels ? "active" : ""}
            onClick={(event) => {
              event.stopPropagation();
              setShowLabels((current) => !current);
            }}
          >
            Labels
          </button>
          <button
            type="button"
            className={showOrphans ? "active" : ""}
            onClick={(event) => {
              event.stopPropagation();
              setShowOrphans((current) => !current);
            }}
          >
            Orphans
          </button>
          <button
            type="button"
            className={colorByFolder ? "active" : ""}
            onClick={(event) => {
              event.stopPropagation();
              setColorByFolder((current) => !current);
            }}
          >
            Folders
          </button>
          {hiddenNodeIds.size > 0 && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setHiddenNodeIds(new Set());
              }}
            >
              Restore {hiddenNodeIds.size}
            </button>
          )}
        </div>

        <div className="graph-help">
          click focus · double click open · right click actions · wheel zoom · drag move
        </div>
      </div>

      <div className="graph-statusbar">
        <div className="graph-stats">
          <span><strong>{graphData.nodes.length}</strong> uzlů</span>
          <span><strong>{graphData.links.length}</strong> vazeb</span>
          <span><strong>{folders.length}</strong> skupin</span>
          {selectedNode && <span className="graph-selected-stat">● {selectedNode.title}</span>}
        </div>

        <div className="graph-legend">
          {colorByFolder && folders.slice(0, 5).map((folder) => (
            <span key={folder}>
              <i style={{ background: colorForFolder(folder) }} />
              {folder || "Vault root"}
            </span>
          ))}
          {colorByFolder && folders.length > 5 && <span>+{folders.length - 5}</span>}
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
            <strong>
              {globalGraph.nodes.find((node) => node.id === contextMenu.nodeId)?.title || "Poznámka"}
            </strong>
          </div>
          <button type="button" onClick={() => onOpenNote(contextMenu.nodeId)}>
            <span>↗</span>
            Otevřít poznámku
          </button>
          <button type="button" onClick={() => openLocalGraph(contextMenu.nodeId)}>
            <span>◎</span>
            Lokální graph
          </button>
          <button type="button" onClick={() => void copyWikiLink(contextMenu.nodeId)}>
            <span>[[ ]]</span>
            Kopírovat wiki link
          </button>
          <button type="button" onClick={() => hideNode(contextMenu.nodeId)}>
            <span>◌</span>
            Skrýt z grafu
          </button>
        </div>
      )}
    </main>
  );
});

export default GraphPane;
