const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { EventEmitter } = require('node:events');
const { createGitHubAuthRuntime } = require('../electron/github-auth-runtime.cjs');

test('real preload and main IPC route consent, verified OAuth and disconnect without exposing credentials', async () => {
  const directory = path.resolve(__dirname, '../electron');
  const requireLocal = createRequire(path.join(directory, 'main.cjs'));
  const handlers = new Map(); const secrets = new Map(); const dialogs = []; const network = [];
  let clock = 0; let ready; let window; let api; let lateExchange;
  const token = 'gho_ipcfixture01234567890123456789';
  const reply = (payload) => ({ ok: true, status: 200, headers: { get: () => 'public_repo' }, json: async () => payload });
  class Window extends EventEmitter {
    constructor() {
      super(); window = this;
      this.webContents = new EventEmitter();
      this.webContents.mainFrame = { url: 'http://127.0.0.1:5173/' };
      this.webContents.setWindowOpenHandler = () => {};
    }
    async loadURL() {}
  }
  const app = new EventEmitter();
  Object.assign(app, { isPackaged: false, requestSingleInstanceLock: () => true, hasSingleInstanceLock: () => true,
    whenReady: () => ({ then: (callback) => { ready = callback; } }), setAppUserModelId: () => {}, getPath: () => directory });
  const electron = { app, BrowserWindow: Window, ipcMain: { handle: (name, callback) => handlers.set(name, callback) },
    dialog: { showMessageBox: async (_owner, options) => { dialogs.push(options); return { response: 1 }; } },
    shell: { openExternal: async (url) => assert.equal(url, 'https://github.com/login/device') } };
  vm.runInNewContext(fs.readFileSync(path.join(directory, 'main.cjs'), 'utf8'), {
    __dirname: directory, URL, AbortController, Buffer,
    process: { platform: process.platform, env: { ETHICAL_GITHUB_CLIENT_ID: 'fixture' } },
    require: (name) => {
      if (name === 'electron') return electron;
      if (name === 'electron-squirrel-startup') return false;
      if (name === 'update-electron-app') return {};
      if (name === './backend-manager.cjs') return { createBackendManager: () => ({ ensure: async () => {}, stop: async () => {} }) };
      if (name === './secure-store.cjs') return { createSecureStore: () => ({
        save: async (key, value) => { secrets.set(key, value); },
        load: async (key) => secrets.get(key) ?? null, delete: async (key) => { secrets.delete(key); },
      }) };
      if (name === './github-auth-runtime.cjs') return { createGitHubAuthRuntime: (options) => createGitHubAuthRuntime({ ...options,
        now: () => clock, fetchImpl: async (url, request) => {
          network.push(url);
          if (url.endsWith('/device/code')) {
            assert.equal(request.body.get('scope'), 'public_repo');
            return reply({ device_code: 'private-device', user_code: 'ABCD-EFGH', verification_uri: 'https://github.com/login/device', expires_in: 900, interval: 5 });
          }
          if (url.endsWith('/oauth/access_token')) {
            assert.equal(request.body.get('device_code'), 'private-device');
            if (lateExchange) return lateExchange;
            return reply({ access_token: token, token_type: 'bearer', scope: 'public_repo' });
          }
          assert.equal(url, 'https://api.github.com/user');
          assert.equal(request.headers.Authorization, `Bearer ${token}`);
          return reply({ login: 'ipc-owner' });
        },
      }) };
      return requireLocal(name);
    },
  });
  // app readiness is driven by the fixture; no backend or Electron executable is spawned.
  ready();
  const trusted = { sender: window.webContents, senderFrame: window.webContents.mainFrame };
  vm.runInNewContext(fs.readFileSync(path.join(directory, 'preload.cjs'), 'utf8'), {
    process: { platform: process.platform }, require: () => ({ contextBridge: { exposeInMainWorld: (_name, value) => { api = value; } },
      ipcRenderer: { invoke: (name, ...args) => handlers.get(name)(trusted, ...args) } }),
  });
  await assert.rejects(handlers.get('desktop:github-start-login')({ sender: window.webContents,
    senderFrame: { url: trusted.senderFrame.url } }, 'public_repo'), /Blocked IPC/);
  const started = await api.githubStartLogin('public_repo');
  assert.equal(JSON.stringify(started).includes('private-device'), false);
  clock += 5000;
  const connected = await api.githubPollLogin(started.sessionId);
  assert.equal(connected.status, 'connected', connected.error);
  assert.equal(connected.login, 'ipc-owner'); assert.equal(secrets.get('github.oauth'), token);
  assert.equal(JSON.stringify(connected).includes(token), false);
  assert.equal(dialogs.length, 3); assert.match(dialogs[1].message, /ABCD-EFGH/); assert.match(dialogs[2].message, /ipc-owner/);
  assert.deepEqual(network, ['https://github.com/login/device/code', 'https://github.com/login/oauth/access_token', 'https://api.github.com/user']);
  const next = await api.githubStartLogin(); clock += 5000;
  let resolve;
  lateExchange = new Promise((accept) => { resolve = accept; });
  const pending = api.githubPollLogin(next.sessionId);
  await api.githubDisconnect();
  resolve(reply({ access_token: token, token_type: 'bearer', scope: 'public_repo' }));
  assert.equal((await pending).status, 'expired'); assert.equal(secrets.has('github.oauth'), false);
});
