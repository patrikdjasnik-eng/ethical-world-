const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { startDeviceLogin, deviceRequest, verifyGitHubToken, createTokenPrompt } = require('../electron/github-auth.cjs');

const response = (status, payload) => ({ status, ok: status >= 200 && status < 300, json: async () => payload });

test('GitHub disabled device flow is diagnosed from its HTTP 400 response', async () => {
  await assert.rejects(startDeviceLogin('fixture', async () => response(400, {
    error: 'device_flow_disabled', error_description: 'This text is not shown verbatim.',
  })), /nemá zapnutý Device Flow/);
});

test('device code responses must contain valid codes, expiry and the trusted GitHub verification URL', async () => {
  const payload = { device_code: 'device-fixture', user_code: 'USER-CODE', verification_uri: 'https://github.com/login/device', expires_in: 900, interval: 5 };
  const started = await startDeviceLogin('fixture', async (url, options) => {
    assert.equal(url, 'https://github.com/login/device/code');
    assert.equal(options.redirect, 'error');
    assert.equal(options.body.get('client_id'), 'fixture');
    return response(200, payload);
  });
  assert.equal(started.user_code, 'USER-CODE');
  await assert.rejects(startDeviceLogin('fixture', async () => response(200, { ...payload, verification_uri: 'https://evil.test' })));
  await assert.rejects(startDeviceLogin('fixture', async () => response(200, { ...payload, device_code: undefined })));
  await assert.rejects(startDeviceLogin('fixture', async () => response(200, { ...payload, expires_in: NaN })));
});

test('polling preserves pending/slow-down responses and rejects terminal errors with a readable message', async () => {
  for (const error of ['authorization_pending', 'slow_down']) {
    assert.equal((await deviceRequest('oauth/access_token', {}, async () => response(200, { error }))).error, error);
  }
  await assert.rejects(deviceRequest('oauth/access_token', {}, async () => response(200, { error: 'access_denied' })), /zamítnuta/);
  await assert.rejects(deviceRequest('device/code', {}, async () => { throw new Error('Network fixture'); }), /nedostupný/);
});

test('manual tokens are validated with GitHub before they can be saved and are not echoed in errors', async () => {
  const token = 'github_pat_fixture0123456789';
  const verified = await verifyGitHubToken(token, async (url, options) => {
    assert.equal(url, 'https://api.github.com/user');
    assert.equal(options.headers.Authorization, `Bearer ${token}`);
    assert.equal(options.redirect, 'error');
    return response(200, { login: 'fixture' });
  });
  assert.deepEqual(verified, { token, login: 'fixture' });
  await assert.rejects(verifyGitHubToken(token, async () => response(401, {})), (error) => !error.message.includes(token) && error.message.includes('neplatný'));
  await assert.rejects(verifyGitHubToken('header\ninjection', async () => assert.fail('No network request for invalid input')));
  await assert.rejects(verifyGitHubToken(token, async () => response(200, {})), /nevrátil/);
});

test('native token prompt is single-flight, isolated from the workspace and removes its IPC handler', async () => {
  const windows = [];
  class Prompt extends EventEmitter {
    constructor(options) {
      super(); this.options = options;
      this.webContents = new EventEmitter();
      this.webContents.mainFrame = {};
      this.webContents.setWindowOpenHandler = (handler) => { this.windowHandler = handler; };
      windows.push(this);
    }
    async loadFile() {}
    show() {}
    close() { this.emit('closed'); }
    destroy() { this.close(); }
  }
  const handlers = new Map();
  const ipcMain = { handle: (channel, handler) => handlers.set(channel, handler), removeHandler: (channel) => handlers.delete(channel) };
  const prompt = createTokenPrompt({ BrowserWindow: Prompt, ipcMain, owner: () => undefined, directory: '/fixture' });
  const first = prompt(); const second = prompt();
  assert.equal(windows.length, 1);
  assert.equal(first, second);
  const window = windows[0];
  assert.equal(window.options.webPreferences.nodeIntegration, false);
  assert.equal(window.options.webPreferences.sandbox, true);
  const submit = handlers.get('desktop:github-token-submit');
  assert.throws(() => submit({ sender: {}, senderFrame: window.webContents.mainFrame }, 'token'), /Untrusted/);
  assert.throws(() => submit({ sender: window.webContents, senderFrame: {} }, 'token'), /Untrusted/);
  submit({ sender: window.webContents, senderFrame: window.webContents.mainFrame }, 'fixture-token');
  assert.equal(await first, 'fixture-token');
  assert.equal(handlers.size, 0);
  const cancellation = prompt(); windows[1].close();
  assert.equal(await cancellation, null);
});
