const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("ethicalDesktop", {
  isDesktop: true,
  gatewayRequest: (request) => ipcRenderer.invoke("desktop:gateway-request", request),
  carrotConfirmSaved: (payload, signature, publicKey) => ipcRenderer.invoke("desktop:carrot-confirm-saved", payload, signature, publicKey),
  carrotVerifyHead: (noteId, commitHash) => ipcRenderer.invoke("desktop:carrot-verify-head", noteId, commitHash),
  platform: process.platform,
  showContextMenu: (items) => ipcRenderer.invoke("desktop:context-menu", items),
  selectVaultFolder: () => ipcRenderer.invoke("desktop:select-vault-folder"),
  selectMarkdownFolder: () => ipcRenderer.invoke("desktop:select-markdown-folder"),
  readMarkdownFiles: (connectionId) => ipcRenderer.invoke("desktop:read-markdown-files", connectionId),
  writeMarkdownFiles: (connectionId, files) => ipcRenderer.invoke("desktop:write-markdown-files", connectionId, files),
  githubStatus: () => ipcRenderer.invoke("desktop:github-status"),
  githubStartLogin: () => ipcRenderer.invoke("desktop:github-start-login"),
  githubConnectToken: () => ipcRenderer.invoke("desktop:github-connect-token"),
  githubPollLogin: (sessionId) => ipcRenderer.invoke("desktop:github-poll-login", sessionId),
  githubDisconnect: () => ipcRenderer.invoke("desktop:github-disconnect"),
  githubListRepos: () => ipcRenderer.invoke("desktop:github-list-repos"),
  githubReadMarkdown: (repoFullName, branch) => ipcRenderer.invoke("desktop:github-read-markdown", repoFullName, branch),
  githubWriteMarkdown: (repoFullName, branch, files) =>
    ipcRenderer.invoke("desktop:github-write-markdown", repoFullName, branch, files),
  authLoadSessionToken: () => ipcRenderer.invoke("desktop:auth-load-session-token"),
  authStoreSessionToken: (token) => ipcRenderer.invoke("desktop:auth-store-session-token", token),
  authClearSessionToken: () => ipcRenderer.invoke("desktop:auth-clear-session-token"),
  carrotSign: (payload) => ipcRenderer.invoke("desktop:carrot-sign", payload),
  carrotVerify: (payload, signature, publicKey) =>
    ipcRenderer.invoke("desktop:carrot-verify", payload, signature, publicKey),
  runtimeStatus: () => ipcRenderer.invoke("desktop:runtime-status")
});
