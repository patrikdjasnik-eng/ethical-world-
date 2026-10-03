import { getStoredSessionToken } from "./auth";

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8787";

export interface NotionStatus {
  configured: boolean;
  connected: boolean;
  workspaceName: string | null;
  workspaceId: string | null;
}

export interface NotionPageSummary {
  id: string;
  title: string;
  url?: string;
}

export interface NotionMarkdownPage {
  pageId: string;
  title: string;
  markdown: string;
  truncated: boolean;
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getStoredSessionToken();
  if (!token) throw new Error("Nejdřív se přihlas do Ethical World účtu.");
  return {
    Authorization: "Bearer " + token,
    "Content-Type": "application/json"
  };
}

async function parseError(response: Response): Promise<string> {
  const payload = await response.json().catch(() => null) as { detail?: string } | null;
  return payload?.detail ?? "Notion požadavek selhal.";
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(apiUrl + path, {
    method: "POST",
    headers: await authHeaders(),
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  if (!response.ok) throw new Error(await parseError(response));
  return response.json() as Promise<T>;
}

export async function getNotionStatus(): Promise<NotionStatus> {
  return post<NotionStatus>("/api/connectors/notion/status");
}

export async function startNotionLogin(): Promise<string> {
  const result = await post<{ authorizationUrl: string }>("/api/connectors/notion/start");
  return result.authorizationUrl;
}

export async function disconnectNotion(): Promise<void> {
  await post("/api/connectors/notion/disconnect");
}

export async function listNotionPages(): Promise<NotionPageSummary[]> {
  const result = await post<{ pages: NotionPageSummary[] }>("/api/connectors/notion/pages");
  return result.pages;
}

export async function readNotionMarkdown(pageId: string): Promise<NotionMarkdownPage> {
  return post<NotionMarkdownPage>("/api/connectors/notion/read", { pageId });
}

export async function writeNotionMarkdown(pageId: string, markdown: string): Promise<void> {
  await post("/api/connectors/notion/write", { pageId, markdown });
}
