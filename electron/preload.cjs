const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("ethicalDesktop", {
  isDesktop: true,
  researchStart: (urls) => ipcRenderer.invoke("desktop:research-start", urls),
  researchList: () => ipcRenderer.invoke("desktop:research-list"),
  researchRead: (id) => ipcRenderer.invoke("desktop:research-read", id),
  researchCancel: (id) => ipcRenderer.invoke("desktop:research-cancel", id),
  researchRemove: (id) => ipcRenderer.invoke("desktop:research-remove", id),
  gatewayRequest: (request) => ipcRenderer.invoke("desktop:gateway-request", request),
  cancelGatewayRequest: (id) => ipcRenderer.invoke("desktop:gateway-request-cancel", id),
  gatewayStreamRequest: async (id, request, onEvent) => {
    const listener = (_event, streamId, data) => { if (streamId === id) onEvent(data); };
    ipcRenderer.on("desktop:gateway-stream-event", listener);
    try { return await ipcRenderer.invoke("desktop:gateway-stream", id, request); }
    finally { ipcRenderer.removeListener("desktop:gateway-stream-event", listener); }
  },
  cancelGatewayStream: (id) => ipcRenderer.invoke("desktop:gateway-stream-cancel", id),
  ensureLocalModel: (request) => ipcRenderer.invoke("desktop:ensure-local-model", request),
  ensureBackendRuntime: () => ipcRenderer.invoke("desktop:ensure-backend"),
  carrotConfirmSaved: (payload, signature, publicKey) => ipcRenderer.invoke("desktop:carrot-confirm-saved", payload, signature, publicKey),
  carrotVerifyHead: (noteId, commitHash) => ipcRenderer.invoke("desktop:carrot-verify-head", noteId, commitHash),
  platform: process.platform,
  showContextMenu: (items) => ipcRenderer.invoke("desktop:context-menu", items),
  selectVaultFolder: () => ipcRenderer.invoke("desktop:select-vault-folder"),
  selectMarkdownFolder: () => ipcRenderer.invoke("desktop:select-markdown-folder"),
  readMarkdownFiles: (connectionId) => ipcRenderer.invoke("desktop:read-markdown-files", connectionId),
  writeMarkdownFiles: (connectionId, files) => ipcRenderer.invoke("desktop:write-markdown-files", connectionId, files),
  githubStatus: () => ipcRenderer.invoke("desktop:github-status"),
  githubStartLogin: (scope) => ipcRenderer.invoke("desktop:github-start-login", scope),
  githubConnectToken: () => ipcRenderer.invoke("desktop:github-connect-token"),
  githubPollLogin: (sessionId) => ipcRenderer.invoke("desktop:github-poll-login", sessionId),
  githubCancelLogin: (sessionId) => ipcRenderer.invoke("desktop:github-cancel-login", sessionId),
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
