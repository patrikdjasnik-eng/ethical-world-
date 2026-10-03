import { describe, expect, it } from "vitest";
import {
  buildKnowledgeGraph,
  buildLocalKnowledgeGraph,
  getConnectedNodeIds
} from "../src/lib/graph";
import type { Note } from "../src/types";

const timestamp = "2026-10-03T00:00:00.000Z";

const notes: Note[] = [
  {
    id: "a",
    title: "A",
    folder: "Projects",
    content: "[[B]] and [[C]]",
    createdAt: timestamp,
    updatedAt: timestamp
  },
  {
    id: "b",
    title: "B",
    folder: "Knowledge",
    content: "[[A]]",
    createdAt: timestamp,
    updatedAt: timestamp
  },
  {
    id: "c",
    title: "C",
    folder: "Knowledge",
    content: "",
    createdAt: timestamp,
    updatedAt: timestamp
  },
  {
    id: "d",
    title: "D",
    folder: "Inbox",
    content: "[[Missing]]",
    createdAt: timestamp,
    updatedAt: timestamp
  }
];

describe("knowledge graph", () => {
  it("builds deduplicated edges from wiki links", () => {
    const graph = buildKnowledgeGraph(notes);

    expect(graph.nodes).toHaveLength(4);
    expect(graph.links).toHaveLength(2);
    expect(graph.nodes.find((node) => node.id === "a")?.degree).toBe(2);
    expect(graph.nodes.find((node) => node.id === "b")?.degree).toBe(1);
  });

  it("builds a local neighborhood around the active note", () => {
    const graph = buildKnowledgeGraph(notes);
    const localGraph = buildLocalKnowledgeGraph(graph, "b");

    expect(localGraph.nodes.map((node) => node.id).sort()).toEqual(["a", "b"]);
    expect(localGraph.links).toHaveLength(1);
  });

  it("returns connected nodes including the selected node", () => {
    const graph = buildKnowledgeGraph(notes);
    expect(Array.from(getConnectedNodeIds(graph, "a")).sort()).toEqual(["a", "b", "c"]);
  });
});
