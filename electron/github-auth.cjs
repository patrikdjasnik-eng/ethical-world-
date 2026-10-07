class GitHubAuthError extends Error {}

function deviceError(code, status) {
  if (code === 'device_flow_disabled') return 'GitHub aplikace nemá zapnutý Device Flow. Připoj GitHub tokenem, nebo zapni Device Flow v nastavení OAuth aplikace.';
  if (code === 'incorrect_client_credentials') return 'GitHub Client ID není platný. Použij připojení tokenem nebo nastav vlastní ETHICAL_GITHUB_CLIENT_ID.';
  if (code === 'access_denied') return 'GitHub autorizace byla zamítnuta.';
  if (code === 'expired_token') return 'GitHub autorizační kód vypršel. Spusť přihlášení znovu.';
  return `GitHub autorizace selhala (HTTP ${status}). Zkus připojení tokenem.`;
}

async function deviceRequest(endpoint, fields, fetchImpl = fetch, signal) {
  if (!['device/code', 'oauth/access_token'].includes(endpoint)) throw new GitHubAuthError('Nepovolený GitHub OAuth endpoint.');
  let response;
  try {
    response = await fetchImpl(`https://github.com/login/${endpoint}`, {
      method: 'POST', redirect: 'error', signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(30000)]) : AbortSignal.timeout(30000),
      headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(fields),
    });
  } catch { throw new GitHubAuthError('GitHub je nedostupný nebo vypršel čas přihlášení. Zkontroluj připojení.'); }
  let payload;
  try { payload = await response.json(); } catch { throw new GitHubAuthError('GitHub vrátil neplatnou odpověď při přihlášení.'); }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new GitHubAuthError('GitHub vrátil neplatnou odpověď při přihlášení.');
  if (!response.ok || (payload.error && !['authorization_pending', 'slow_down'].includes(payload.error))) {
    throw new GitHubAuthError(deviceError(payload.error, response.status));
  }
  return payload;
}

async function startDeviceLogin(clientId, fetchImpl = fetch, { scope = 'public_repo', signal } = {}) {
  if (!['public_repo', 'repo'].includes(scope)) throw new GitHubAuthError('Nepovolený GitHub scope.');
  const payload = await deviceRequest('device/code', { client_id: clientId, scope }, fetchImpl, signal);
  const interval = Number(payload.interval ?? 5);
  const expiresIn = Number(payload.expires_in);
  if (typeof payload.device_code !== 'string' || !/^[A-Za-z0-9_-]{1,256}$/.test(payload.device_code) ||
      typeof payload.user_code !== 'string' || !/^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(payload.user_code) ||
      payload.verification_uri !== 'https://github.com/login/device' || !Number.isInteger(interval) || interval < 1 || interval > 60 ||
      !Number.isInteger(expiresIn) || expiresIn < 1 || expiresIn > 1800) {
    throw new GitHubAuthError('GitHub nevrátil platný autorizační kód. Spusť přihlášení znovu.');
  }
  return { device_code: payload.device_code, user_code: payload.user_code, verification_uri: payload.verification_uri,
    interval: Math.max(interval, 5), expires_in: expiresIn };
}

async function verifyGitHubToken(rawToken, fetchImpl = fetch, signal) {
  const token = typeof rawToken === 'string' ? rawToken.trim() : '';
  if (!/^[A-Za-z0-9_]{20,255}$/.test(token)) throw new GitHubAuthError('Token má neplatný formát.');
  let response;
  try {
    response = await fetchImpl('https://api.github.com/user', {
      redirect: 'error', signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(30000)]) : AbortSignal.timeout(30000),
      headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'User-Agent': 'Ethical-World-Desktop' },
    });
  } catch { throw new GitHubAuthError('GitHub je nedostupný. Token nebyl uložen.'); }
  if (!response.ok) throw new GitHubAuthError(response.status === 401 ? 'GitHub token je neplatný nebo vypršel.' : `GitHub token nelze ověřit (HTTP ${response.status}).`);
  let user;
  try { user = await response.json(); } catch { throw new GitHubAuthError('GitHub nevrátil platný účet. Token nebyl uložen.'); }
  if (!user || typeof user !== 'object' || Array.isArray(user) || typeof user.login !== 'string' || !/^[A-Za-z0-9-]{1,39}$/.test(user.login)) throw new GitHubAuthError('GitHub nevrátil přihlášený účet. Token nebyl uložen.');
  const scopes = response.headers?.get('x-oauth-scopes');
  return { token, login: user.login, ...(scopes != null ? { scopes } : {}) };
}

function createTokenPrompt({ BrowserWindow, ipcMain, owner, directory }) {
  const path = require('node:path');
  let pending = null;
  return function requestToken() {
    if (pending) return pending;
    pending = new Promise((resolve, reject) => {
      const prompt = new BrowserWindow({
        width: 600, height: 490, parent: owner(), modal: true, show: false, resizable: false,
        autoHideMenuBar: true, backgroundColor: '#101116',
        webPreferences: { preload: path.join(directory, 'github-token-preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true },
      });
      let result = null;
      const channel = 'desktop:github-token-submit';
      ipcMain.handle(channel, (event, value) => {
        if (event.sender !== prompt.webContents || event.senderFrame !== prompt.webContents.mainFrame) throw new GitHubAuthError('Untrusted token prompt.');
        if (value !== null && (typeof value !== 'string' || value.length > 255)) throw new GitHubAuthError('Invalid token input.');
        result = value;
        prompt.close();
        return true;
      });
      prompt.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
      prompt.webContents.on('will-navigate', (event) => event.preventDefault());
      prompt.webContents.on('will-attach-webview', (event) => event.preventDefault());
      prompt.once('ready-to-show', () => prompt.show());
      prompt.once('closed', () => { ipcMain.removeHandler(channel); resolve(result); });
      void prompt.loadFile(path.join(directory, 'github-token.html')).catch((error) => { reject(error); prompt.destroy(); });
    }).finally(() => { pending = null; });
    return pending;
  };
}

module.exports = { GitHubAuthError, deviceError, deviceRequest, startDeviceLogin, verifyGitHubToken, createTokenPrompt };
