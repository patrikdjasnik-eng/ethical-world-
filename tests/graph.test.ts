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


describe("related graph edges", () => {
  it("creates inferred edges for strongly related note titles", () => {
    const relatedNotes: Note[] = [
      {
        id: "ransomware",
        title: "Malware Script - Ransomware",
        folder: "",
        content: "",
        createdAt: timestamp,
        updatedAt: timestamp
      },
      {
        id: "trojan",
        title: "Malware Script - Trojan",
        folder: "",
        content: "",
        createdAt: timestamp,
        updatedAt: timestamp
      },
      {
        id: "welcome",
        title: "Vítej v Ethical World",
        folder: "",
        content: "",
        createdAt: timestamp,
        updatedAt: timestamp
      }
    ];

    const graph = buildKnowledgeGraph(relatedNotes, true);

    expect(graph.links).toHaveLength(1);
    expect(graph.links[0]).toMatchObject({
      source: "ransomware",
      target: "trojan",
      kind: "related"
    });
  });

  it("keeps inferred edges optional", () => {
    const relatedNotes: Note[] = [
      {
        id: "one",
        title: "Malware Ransomware",
        folder: "",
        content: "",
        createdAt: timestamp,
        updatedAt: timestamp
      },
      {
        id: "two",
        title: "Malware Trojan",
        folder: "",
        content: "",
        createdAt: timestamp,
        updatedAt: timestamp
      }
    ];

    expect(buildKnowledgeGraph(relatedNotes, false).links).toHaveLength(0);
  });
});

it("bounds inferred relationships in a 2000-note vault with a shared tag", () => {
  const large = Array.from({ length: 2000 }, (_, index) => ({ ...notes[0], id: String(index), title: "Topic " + index, content: "#security\n" + "body ".repeat(1200) }));
  const graph = buildKnowledgeGraph(large);
  expect(graph.links).toHaveLength(0);
  large[0].content += "\n[[Topic 1999]]";
  expect(buildKnowledgeGraph(large).links).toHaveLength(1);
});
