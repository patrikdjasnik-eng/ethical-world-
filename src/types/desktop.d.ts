export interface DesktopContextMenuItem {
  id?: string;
  label?: string;
  enabled?: boolean;
  type?: "separator";
}

export interface EthicalDesktopApi {
  isDesktop: true;
  platform: string;
  showContextMenu: (items: DesktopContextMenuItem[]) => Promise<string | null>;
  selectVaultFolder: () => Promise<string | null>;
}

declare global {
  interface Window {
    ethicalDesktop?: EthicalDesktopApi;
  }
}

export {};
