const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("ethicalDesktop", {
  isDesktop: true,
  platform: process.platform,
  showContextMenu: (items) => ipcRenderer.invoke("desktop:context-menu", items),
  selectVaultFolder: () => ipcRenderer.invoke("desktop:select-vault-folder"),
  selectMarkdownFolder: () => ipcRenderer.invoke("desktop:select-markdown-folder"),
  readMarkdownFiles: (connectionId) => ipcRenderer.invoke("desktop:read-markdown-files", connectionId),
  writeMarkdownFiles: (connectionId, files) => ipcRenderer.invoke("desktop:write-markdown-files", connectionId, files)
});
