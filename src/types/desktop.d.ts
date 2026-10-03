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
  | { status: "error"; error?: string };

export interface EthicalDesktopApi {
  isDesktop: true;
  platform: string;
  showContextMenu: (items: DesktopContextMenuItem[]) => Promise<string | null>;
  selectVaultFolder: () => Promise<string | null>;
  selectMarkdownFolder: () => Promise<DesktopMarkdownConnection | null>;
  readMarkdownFiles: (connectionId: string) => Promise<{ files: DesktopMarkdownFile[]; truncated: boolean }>;
  writeMarkdownFiles: (connectionId: string, files: DesktopMarkdownFile[]) => Promise<{ written: number }>;
  githubStatus: () => Promise<DesktopGitHubStatus>;
  githubStartLogin: () => Promise<DesktopGitHubLoginStart>;
  githubPollLogin: (sessionId: string) => Promise<DesktopGitHubLoginPoll>;
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
  runtimeStatus: () => Promise<{
    backendOnline: boolean;
    backendSource: "external" | "bundled" | "venv" | "python" | "py" | "offline";
    githubClientConfigured: boolean;
  }>;
}

declare global {
  interface Window {
    ethicalDesktop?: EthicalDesktopApi;
  }
}

export {};
