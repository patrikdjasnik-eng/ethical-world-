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

export interface EthicalDesktopApi {
  isDesktop: true;
  platform: string;
  showContextMenu: (items: DesktopContextMenuItem[]) => Promise<string | null>;
  selectVaultFolder: () => Promise<string | null>;
  selectMarkdownFolder: () => Promise<DesktopMarkdownConnection | null>;
  readMarkdownFiles: (connectionId: string) => Promise<{ files: DesktopMarkdownFile[]; truncated: boolean }>;
  writeMarkdownFiles: (connectionId: string, files: DesktopMarkdownFile[]) => Promise<{ written: number }>;
}

declare global {
  interface Window {
    ethicalDesktop?: EthicalDesktopApi;
  }
}

export {};
