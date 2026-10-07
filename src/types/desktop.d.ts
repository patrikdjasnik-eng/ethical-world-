export interface DesktopContextMenuItem {
  id?: string;
  label?: string;
  enabled?: boolean;
  type?: "separator";
}

export interface DesktopMarkdownConnection {
  id: string;
  label: string;
}

export interface DesktopMarkdownFile {
  relativePath: string;
  content: string;
}

export interface DesktopGitHubStatus {
  configured: boolean;
  connected: boolean;
  login: string | null;
}

export interface DesktopGitHubRepo {
  fullName: string;
  private: boolean;
  defaultBranch: string;
  canPush: boolean;
}

export interface DesktopGitHubLoginStart {
  configured: boolean;
  cancelled?: boolean;
  error?: string;
  sessionId?: string;
  userCode?: string;
  verificationUri?: string;
  intervalSeconds?: number;
  expiresAt?: number;
}

export type DesktopGitHubLoginPoll =
  | { status: "pending"; intervalSeconds?: number }
  | { status: "connected"; login: string | null }
  | { status: "expired" }
  | { status: "cancelled" }
  | { status: "error"; error?: string };

export interface EthicalDesktopApi {
  isDesktop: true;
  gatewayStreamRequest?: (id: string, request: { path: string; method: "POST"; body: string }, onEvent: (event: unknown) => void) => Promise<unknown>;
  cancelGatewayStream?: (id: string) => Promise<void>;
  ensureBackendRuntime?: () => Promise<{
    state: "ready" | "error";
    source: "bundled" | "venv" | "python" | "py" | "offline";
    message: string;
  }>;
  ensureLocalModel?: (request: { model: string; baseUrl: string; warmup?: boolean }) => Promise<{
    state: "ready" | "missing" | "unsupported" | "error";
    message: string;
    model?: string;
    warmupMs?: number;
  }>;
  gatewayRequest: (request: {
    path: string;
    method: "GET" | "POST";
    headers: Record<string, string>;
    body?: string;
  }) => Promise<{ status: number; body: string }>;
  carrotConfirmSaved: (payload: string, signature: string, publicKey: string) => Promise<boolean>;
  carrotVerifyHead: (noteId: string, commitHash: string) => Promise<boolean | null>;
  platform: string;
  showContextMenu: (items: DesktopContextMenuItem[]) => Promise<string | null>;
  selectVaultFolder: () => Promise<string | null>;
  selectMarkdownFolder: () => Promise<DesktopMarkdownConnection | null>;
  readMarkdownFiles: (connectionId: string) => Promise<{ files: DesktopMarkdownFile[]; truncated: boolean }>;
  writeMarkdownFiles: (connectionId: string, files: DesktopMarkdownFile[]) => Promise<{ written: number }>;
  githubStatus: () => Promise<DesktopGitHubStatus>;
  githubStartLogin: (scope?: "public_repo" | "repo") => Promise<DesktopGitHubLoginStart>;
  githubConnectToken: () => Promise<{ connected: boolean; login: string | null; error?: string }>;
  githubPollLogin: (sessionId: string) => Promise<DesktopGitHubLoginPoll>;
  githubCancelLogin: (sessionId?: string) => Promise<boolean>;
  githubDisconnect: () => Promise<{ connected: false }>;
  githubListRepos: () => Promise<DesktopGitHubRepo[]>;
  githubReadMarkdown: (
    repoFullName: string,
    branch?: string
  ) => Promise<{
    files: DesktopMarkdownFile[];
    repoFullName: string;
    branch: string;
    connectionId: string;
    truncated: boolean;
  }>;
  githubWriteMarkdown: (
    repoFullName: string,
    branch: string,
    files: DesktopMarkdownFile[]
  ) => Promise<{ written: number; branch: string; commitSha: string }>;
  authLoadSessionToken: () => Promise<string | null>;
  authStoreSessionToken: (token: string) => Promise<boolean>;
  authClearSessionToken: () => Promise<boolean>;
  carrotSign: (payload: string) => Promise<{
    signature: string;
    publicKey: string;
    keyId: string;
  }>;
  carrotVerify: (payload: string, signature: string, publicKey: string) => Promise<boolean>;
  runtimeStatus: () => Promise<{
    backendOnline: boolean;
    backendSource: "external" | "bundled" | "venv" | "python" | "py" | "offline";
    backendMessage?: string;
    backendLogPath?: string;
    githubClientConfigured: boolean;
  }>;
}

declare global {
  interface Window {
    ethicalDesktop?: EthicalDesktopApi;
  }
}

export {};
