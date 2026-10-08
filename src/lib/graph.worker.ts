import { buildKnowledgeGraph } from "./graph";
import type { Note } from "../types";

self.onmessage = (event: MessageEvent<{ notes: Note[]; includeRelated: boolean }>) => {
  self.postMessage(buildKnowledgeGraph(event.data.notes, event.data.includeRelated));
};
