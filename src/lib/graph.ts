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
  kind: "wiki" | "related";
  score: number;
}

export interface KnowledgeGraphData {
  nodes: KnowledgeGraphNode[];
  links: KnowledgeGraphLink[];
}

const stopWords = new Set([
  "and", "the", "for", "with", "from", "into", "about",
  "script", "scripts", "note", "notes", "markdown",
  "ale", "bez", "jak", "jako", "jsou", "nad", "nebo", "pod", "pro", "pri",
  "při", "se", "ve"
]);

function normalizedTokens(value: string): Set<string> {
  return new Set(
    value
      .toLocaleLowerCase("cs-CZ")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .split(/[^a-z0-9]+/g)
      .map((token) => token.trim())
      .filter((token) => token.length >= 3 && !stopWords.has(token))
  );
}

function markdownTags(content: string): Set<string> {
  const tags = new Set<string>();

  for (const match of content.matchAll(/(?:^|\s)#([\p{L}\p{N}_-]{2,64})/gu)) {
    tags.add(match[1].toLocaleLowerCase("cs-CZ"));
  }

  return tags;
}

function overlap(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 || right.size === 0) return 0;

  let shared = 0;
  for (const item of left) {
    if (right.has(item)) shared += 1;
  }

  return shared / Math.min(left.size, right.size);
}

interface NoteFeatures {
  titleTokens: Set<string>;
  tags: Set<string>;
  folder: string;
}

function relatedScore(left: NoteFeatures, right: NoteFeatures): number {
  const titleScore = overlap(left.titleTokens, right.titleTokens);
  const tagScore = overlap(left.tags, right.tags);
  const sameFolder = Boolean(left.folder && left.folder === right.folder);
  return Math.min(1, titleScore * 0.82 + tagScore * 0.46 + (sameFolder ? 0.12 : 0));
}

export function buildKnowledgeGraph(notes: Note[], includeRelated = true): KnowledgeGraphData {
  const notesByTitle = new Map(notes.map((note) => [normalizeTitle(note.title), note]));
  const links: KnowledgeGraphLink[] = [];
  const seenLinks = new Set<string>();
  const degreeById = new Map(notes.map((note) => [note.id, 0]));

  const addLink = (
    source: Note,
    target: Note,
    kind: "wiki" | "related",
    score: number
  ) => {
    const edgeKey = [source.id, target.id].sort().join("::");
    if (seenLinks.has(edgeKey)) return;

    seenLinks.add(edgeKey);
    links.push({ source: source.id, target: target.id, kind, score });
    degreeById.set(source.id, (degreeById.get(source.id) ?? 0) + 1);
    degreeById.set(target.id, (degreeById.get(target.id) ?? 0) + 1);
  };

  for (const note of notes) {
    for (const linkedTitle of extractWikiLinks(note.content)) {
      const target = notesByTitle.get(normalizeTitle(linkedTitle));
      if (!target || target.id === note.id) continue;
      addLink(note, target, "wiki", 1);
    }
  }

  if (includeRelated) {
    const features = notes.map((note) => ({
      titleTokens: normalizedTokens(note.title),
      tags: markdownTags(note.content),
      folder: note.folder
    }));

    const index = new Map<string, number[]>();
    features.forEach((feature, noteIndex) => {
      for (const key of [...feature.titleTokens].map((token) => "title:" + token).concat([...feature.tags].map((tag) => "tag:" + tag))) {
        const posting = index.get(key) ?? [];
        posting.push(noteIndex);
        index.set(key, posting);
      }
    });
    const relatedDegree = new Map<string, number>();
    const maxRelatedLinks = Math.min(6000, notes.length * 4);
    let relatedLinks = 0;
    for (let leftIndex = 0; leftIndex < notes.length && relatedLinks < maxRelatedLinks; leftIndex += 1) {
      const feature = features[leftIndex];
      const candidates = new Set<number>();
      const keys = [...feature.titleTokens].map((token) => "title:" + token).concat([...feature.tags].map((tag) => "tag:" + tag));
      for (const key of keys) {
        const posting = index.get(key) ?? [];
        // Broad tags describe the vault, not a useful relationship between every note.
        if (posting.length > 64 || (key.startsWith("tag:") && posting.length > Math.max(3, notes.length * 0.2))) continue;
        for (const rightIndex of posting) {
          if (rightIndex > leftIndex) candidates.add(rightIndex);
          if (candidates.size >= 128) break;
        }
        if (candidates.size >= 128) break;
      }
      const ranked = [...candidates].map((rightIndex) => ({ rightIndex, score: relatedScore(feature, features[rightIndex]) }))
        .filter((candidate) => candidate.score >= 0.4)
        .sort((a, b) => b.score - a.score || a.rightIndex - b.rightIndex).slice(0, 6);
      for (const { rightIndex, score } of ranked) {
        const left = notes[leftIndex];
        const right = notes[rightIndex];
        if (relatedLinks >= maxRelatedLinks || (relatedDegree.get(left.id) ?? 0) >= 8 || (relatedDegree.get(right.id) ?? 0) >= 8) continue;
        const count = links.length;
        addLink(left, right, "related", score);
        if (links.length > count) {
          relatedLinks += 1;
          relatedDegree.set(left.id, (relatedDegree.get(left.id) ?? 0) + 1);
          relatedDegree.set(right.id, (relatedDegree.get(right.id) ?? 0) + 1);
        }
      }
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
  if (!activeNoteId) return { nodes: [], links: [] };

  const visibleNodeIds = new Set<string>([activeNoteId]);

  for (const link of graph.links) {
    if (link.source === activeNoteId) visibleNodeIds.add(link.target);
    else if (link.target === activeNoteId) visibleNodeIds.add(link.source);
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
    if (link.source === nodeId) connected.add(link.target);
    else if (link.target === nodeId) connected.add(link.source);
  }

  return connected;
}
