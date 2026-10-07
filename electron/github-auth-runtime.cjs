const { randomUUID } = require('node:crypto');
const { GitHubAuthError, startDeviceLogin, deviceRequest, verifyGitHubToken } = require('./github-auth.cjs');

function checkScopes(value, approved) {
  if (typeof value !== 'string' || value.length > 512) throw new GitHubAuthError('GitHub nevrátil platná oprávnění. Token nebyl uložen.');
  const scopes = value.split(/[ ,]+/).filter(Boolean);
  const allowed = approved === 'repo' ? ['repo', 'public_repo', 'repo:status', 'repo_deployment', 'repo:invite', 'security_events'] : ['public_repo'];
  if (scopes.some((scope) => !allowed.includes(scope))) {
    throw new GitHubAuthError('GitHub vrátil širší oprávnění, než byla schválena. Odeber starý grant v GitHub Settings → Applications a připojení zopakuj. Token nebyl uložen.');
  }
  return scopes.join(', ') || 'bez dodatečných oprávnění';
}

function createGitHubAuthRuntime({ clientId, fetchImpl = fetch, saveToken, deleteToken, loadToken,
  confirmStart, confirmDeviceCode, confirmAccount, openVerification, requestToken, now = Date.now }) {
  const configured = typeof clientId === 'string' && /^[A-Za-z0-9]{6,64}$/.test(clientId);
  let operation = null;
  let writes = Promise.resolve();
  const expired = () => ({ status: 'expired' });
  const current = (session) => operation === session && !session.controller.signal.aborted && now() < session.expiresAt;
  const serialWrite = (task) => {
    const result = writes.catch(() => undefined).then(task);
    writes = result;
    return result;
  };
  function cancel(sessionId) {
    if (sessionId && operation?.id !== sessionId) return;
    operation?.controller.abort();
    operation = null;
  }
  function begin() {
    cancel();
    operation = { id: randomUUID(), controller: new AbortController(), expiresAt: now() + 15 * 60 * 1000 };
    return operation;
  }
  function failure(error) {
    return error instanceof GitHubAuthError ? error.message : 'GitHub přihlášení selhalo. Token nebyl uložen.';
  }
  async function commit(session, verified, scopes) {
    if (!current(session)) return false;
    const accepted = await confirmAccount({ login: verified.login, scopes });
    if (!accepted || !current(session)) return false;
    // Recheck inside the same queue as disconnect; a late response cannot restore a deleted credential.
    return serialWrite(async () => {
      const previous = await loadToken();
      if (!current(session)) return false;
      await saveToken(verified.token);
      if (current(session)) return true;
      if (previous) await saveToken(previous);
      else await deleteToken();
      return false;
    });
  }
  async function start(scope = 'public_repo') {
    if (!configured) return { configured: false };
    if (!['public_repo', 'repo'].includes(scope)) return { configured: true, error: 'Nepovolený GitHub scope.' };
    // One operation includes the native consent, HTTP exchange and persistence.
    if (operation && !current(operation)) cancel();
    if (operation) return { configured: true, error: 'Přihlášení už probíhá. Nejdřív ho zruš.' };
    const session = begin();
    try {
      if (!await confirmStart({ clientId, scope }) || !current(session)) return { configured: true, cancelled: true };
      const requestedAt = now();
      const payload = await startDeviceLogin(clientId, fetchImpl, { scope, signal: session.controller.signal });
      if (!current(session)) return { configured: true, cancelled: true };
      session.scope = scope;
      session.deviceCode = payload.device_code;
      session.interval = payload.interval;
      session.expiresAt = Math.min(session.expiresAt, requestedAt + payload.expires_in * 1000);
      session.nextPollAt = now() + session.interval * 1000;
      if (!await confirmDeviceCode({ userCode: payload.user_code }) || !current(session)) return { configured: true, cancelled: true };
      await openVerification(payload.verification_uri);
      if (!current(session)) return { configured: true, cancelled: true };
      session.started = true;
      return { configured: true, sessionId: session.id, userCode: payload.user_code,
        verificationUri: payload.verification_uri, intervalSeconds: session.interval, expiresAt: session.expiresAt };
    } catch (error) {
      return current(session) ? { configured: true, error: failure(error) } : { configured: true, cancelled: true };
    } finally {
      if (!session.started && operation === session) cancel(session.id);
    }
  }
  async function exchange(session) {
    try {
      const payload = await deviceRequest('oauth/access_token', {
        client_id: clientId, device_code: session.deviceCode, grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      }, fetchImpl, session.controller.signal);
      if (!current(session)) return expired();
      if (payload.error === 'authorization_pending' || payload.error === 'slow_down') {
        if (payload.error === 'slow_down') session.interval += 5;
        session.nextPollAt = now() + session.interval * 1000;
        return { status: 'pending', intervalSeconds: session.interval };
      }
      if (payload.token_type?.toLowerCase() !== 'bearer' || typeof payload.access_token !== 'string') {
        throw new GitHubAuthError('GitHub vrátil neplatný token. Token nebyl uložen.');
      }
      checkScopes(payload.scope, session.scope);
      const verified = await verifyGitHubToken(payload.access_token, fetchImpl, session.controller.signal);
      if (!current(session)) return expired();
      const scopes = checkScopes(verified.scopes, session.scope);
      if (!await commit(session, verified, scopes)) return current(session) ? { status: 'cancelled' } : expired();
      return { status: 'connected', login: verified.login };
    } catch (error) {
      return current(session) ? { status: 'error', error: failure(error) } : expired();
    }
  }
  function poll(sessionId) {
    const session = operation;
    if (!session || session.id !== sessionId || !session.started) return Promise.resolve(expired());
    if (!current(session)) { cancel(session.id); return Promise.resolve(expired()); }
    if (session.inFlight) return session.inFlight;
    if (now() < session.nextPollAt) return Promise.resolve({ status: 'pending', intervalSeconds: session.interval });
    session.nextPollAt = now() + session.interval * 1000;
    session.inFlight = exchange(session).then((result) => {
      if (result.status !== 'pending' && operation === session) cancel(session.id);
      return result;
    }).finally(() => { session.inFlight = null; });
    return session.inFlight;
  }
  async function connectToken() {
    if (operation && !current(operation)) cancel();
    if (operation) return { connected: false, login: null, error: 'Přihlášení už probíhá. Nejdřív ho zruš.' };
    const session = begin();
    try {
      const rawToken = await requestToken();
      if (rawToken === null || !current(session)) return { connected: false, login: null };
      const verified = await verifyGitHubToken(rawToken, fetchImpl, session.controller.signal);
      if (!await commit(session, verified, verified.scopes || 'oprávnění vybraných repozitářů z tokenu')) return { connected: false, login: null };
      return { connected: true, login: verified.login };
    } catch (error) { return { connected: false, login: null, error: failure(error) }; }
    finally { if (operation === session) cancel(session.id); }
  }
  async function disconnect() {
    cancel();
    await serialWrite(deleteToken);
    return { connected: false };
  }
  async function dropRejectedToken(token) {
    await serialWrite(async () => { if (await loadToken() === token) await deleteToken(); });
  }
  return { configured, start, poll, cancel, connectToken, disconnect, dropRejectedToken };
}

module.exports = { createGitHubAuthRuntime, checkScopes };
