const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("ethicalDesktop", {
  isDesktop: true,
  platform: process.platform,
  showContextMenu: (items) => ipcRenderer.invoke("desktop:context-menu", items),
  selectVaultFolder: () => ipcRenderer.invoke("desktop:select-vault-folder")
});
