import type { Note } from "../types";
import { extractWikiLinks, normalizeTitle } from "./notes";

export interface KnowledgeGraphNode {
  id: string;
  title: string;
  folder: string;
  degree: number;
}

export interface KnowledgeGraphLink {
  source: string;
  target: string;
}

export interface KnowledgeGraphData {
  nodes: KnowledgeGraphNode[];
  links: KnowledgeGraphLink[];
}

export function buildKnowledgeGraph(notes: Note[]): KnowledgeGraphData {
  const notesByTitle = new Map(
    notes.map((note) => [normalizeTitle(note.title), note])
  );
  const links: KnowledgeGraphLink[] = [];
  const seenLinks = new Set<string>();
  const degreeById = new Map(notes.map((note) => [note.id, 0]));

  for (const note of notes) {
    for (const linkedTitle of extractWikiLinks(note.content)) {
      const target = notesByTitle.get(normalizeTitle(linkedTitle));

      if (!target || target.id === note.id) {
        continue;
      }

      const edgeKey = [note.id, target.id].sort().join("::");

      if (seenLinks.has(edgeKey)) {
        continue;
      }

      seenLinks.add(edgeKey);
      links.push({ source: note.id, target: target.id });
      degreeById.set(note.id, (degreeById.get(note.id) ?? 0) + 1);
      degreeById.set(target.id, (degreeById.get(target.id) ?? 0) + 1);
    }
  }

  return {
    nodes: notes.map((note) => ({
      id: note.id,
      title: note.title || "Bez názvu",
      folder: note.folder || "Notes",
      degree: degreeById.get(note.id) ?? 0
    })),
    links
  };
}

export function buildLocalKnowledgeGraph(
  graph: KnowledgeGraphData,
  activeNoteId: string | null
): KnowledgeGraphData {
  if (!activeNoteId) {
    return { nodes: [], links: [] };
  }

  const visibleNodeIds = new Set<string>([activeNoteId]);

  for (const link of graph.links) {
    if (link.source === activeNoteId) {
      visibleNodeIds.add(link.target);
    } else if (link.target === activeNoteId) {
      visibleNodeIds.add(link.source);
    }
  }

  return {
    nodes: graph.nodes.filter((node) => visibleNodeIds.has(node.id)),
    links: graph.links.filter(
      (link) => visibleNodeIds.has(link.source) && visibleNodeIds.has(link.target)
    )
  };
}

export function getConnectedNodeIds(
  graph: KnowledgeGraphData,
  nodeId: string
): Set<string> {
  const connected = new Set<string>([nodeId]);

  for (const link of graph.links) {
    if (link.source === nodeId) {
      connected.add(link.target);
    } else if (link.target === nodeId) {
      connected.add(link.source);
    }
  }

  return connected;
}
