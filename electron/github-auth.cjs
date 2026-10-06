function deviceError(code, status) {
  if (code === 'device_flow_disabled') return 'GitHub aplikace nemá zapnutý Device Flow. Připoj GitHub tokenem, nebo zapni Device Flow v nastavení OAuth aplikace.';
  if (code === 'incorrect_client_credentials') return 'GitHub Client ID není platný. Použij připojení tokenem nebo nastav vlastní ETHICAL_GITHUB_CLIENT_ID.';
  if (code === 'access_denied') return 'GitHub autorizace byla zamítnuta.';
  if (code === 'expired_token') return 'GitHub autorizační kód vypršel. Spusť přihlášení znovu.';
  return `GitHub autorizace selhala (HTTP ${status}). Zkus připojení tokenem.`;
}

async function deviceRequest(endpoint, fields, fetchImpl = fetch) {
  let response;
  try {
    response = await fetchImpl(`https://github.com/login/${endpoint}`, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(30000),
      headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(fields),
    });
  } catch { throw new Error('GitHub je nedostupný nebo vypršel čas přihlášení. Zkontroluj připojení.'); }
  let payload;
  try { payload = await response.json(); } catch { throw new Error('GitHub vrátil neplatnou odpověď při přihlášení.'); }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('GitHub vrátil neplatnou odpověď při přihlášení.');
  if (!response.ok || (payload.error && !['authorization_pending', 'slow_down'].includes(payload.error))) {
    throw new Error(deviceError(payload.error, response.status));
  }
  return payload;
}

async function startDeviceLogin(clientId, fetchImpl = fetch) {
  const payload = await deviceRequest('device/code', { client_id: clientId, scope: 'repo read:user' }, fetchImpl);
  const interval = Number(payload.interval ?? 5);
  const expiresIn = Number(payload.expires_in);
  if (typeof payload.device_code !== 'string' || !payload.device_code || typeof payload.user_code !== 'string' ||
      payload.verification_uri !== 'https://github.com/login/device' || !Number.isFinite(interval) || interval < 1 || interval > 60 ||
      !Number.isFinite(expiresIn) || expiresIn < 1 || expiresIn > 1800) {
    throw new Error('GitHub nevrátil platný autorizační kód. Spusť přihlášení znovu.');
  }
  return { ...payload, interval: Math.max(interval, 5), expires_in: expiresIn };
}

async function verifyGitHubToken(rawToken, fetchImpl = fetch) {
  const token = String(rawToken ?? '').trim();
  if (!/^[A-Za-z0-9_]{20,255}$/.test(token)) throw new Error('Token má neplatný formát.');
  let response;
  try {
    response = await fetchImpl('https://api.github.com/user', {
      redirect: 'error', signal: AbortSignal.timeout(30000),
      headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'User-Agent': 'Ethical-World-Desktop' },
    });
  } catch { throw new Error('GitHub je nedostupný. Token nebyl uložen.'); }
  if (!response.ok) throw new Error(response.status === 401 ? 'GitHub token je neplatný nebo vypršel.' : `GitHub token nelze ověřit (HTTP ${response.status}).`);
  const user = await response.json();
  if (typeof user.login !== 'string' || !user.login) throw new Error('GitHub nevrátil přihlášený účet. Token nebyl uložen.');
  return { token, login: user.login };
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
        if (event.sender !== prompt.webContents || event.senderFrame !== prompt.webContents.mainFrame) throw new Error('Untrusted token prompt.');
        if (value !== null && (typeof value !== 'string' || value.length > 255)) throw new Error('Invalid token input.');
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

module.exports = { deviceError, deviceRequest, startDeviceLogin, verifyGitHubToken, createTokenPrompt };
