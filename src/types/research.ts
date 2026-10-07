export interface ResearchResult {
  title: string;
  url: string;
  text: string;
  incomplete: boolean;
  fetchedAt: string;
}

export interface ResearchJob {
  id: string;
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled" | "interrupted";
  urls: string[];
  createdAt: string;
  finishedAt?: string;
  completed: number;
  failed: number;
  resultCount: number;
  logs: string[];
  results?: ResearchResult[];
}
