const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('githubTokenPrompt', {
  submit: (value) => ipcRenderer.invoke('desktop:github-token-submit', value),
});
