const test = require('node:test');
const assert = require('node:assert/strict');
const { createGitHubAuthRuntime } = require('../electron/github-auth-runtime.cjs');

const token = 'gho_fixture01234567890123456789';
const device = { device_code: 'private-device-code', user_code: 'ABCD-EFGH', verification_uri: 'https://github.com/login/device', interval: 5, expires_in: 900 };
const grant = { access_token: token, token_type: 'bearer', scope: 'public_repo' };
const response = (payload, status = 200, scopes = 'public_repo') => ({ ok: status === 200, status,
  headers: { get: () => scopes }, json: async () => payload });
function deferred() {
  let resolve;
  const promise = new Promise((accept) => { resolve = accept; });
  return { promise, resolve };
}
function fixture(overrides = {}) {
  let clock = 0;
  let stored = 'previous-token';
  const calls = { network: [], saved: [], accounts: [], starts: [] };
  const config = {
    clientId: 'fixture', now: () => clock,
    fetchImpl: async (url, options) => {
      calls.network.push({ url, options });
      if (url.endsWith('/device/code')) return response(device);
      if (url.endsWith('/oauth/access_token')) return response(grant);
      return response({ login: 'fixture-owner' });
    },
    confirmStart: async (value) => { calls.starts.push(value); return true; },
    confirmDeviceCode: async ({ userCode }) => { assert.equal(userCode, device.user_code); return true; },
    confirmAccount: async (value) => { calls.accounts.push(value); return true; },
    openVerification: async (url) => { assert.equal(url, device.verification_uri); },
    requestToken: async () => token,
    loadToken: async () => stored,
    saveToken: async (value) => { calls.saved.push(value); stored = value; },
    deleteToken: async () => { stored = null; },
    ...overrides,
  };
  return { runtime: createGitHubAuthRuntime(config), calls, config,
    advance: (amount = 5000) => { clock += amount; }, stored: () => stored };
}

test('device login uses explicit consent, public scope, verified account and main-only secrets', async () => {
  const f = fixture();
  const started = await f.runtime.start();
  assert.equal(f.calls.starts[0].scope, 'public_repo');
  assert.equal(f.calls.network[0].options.body.get('scope'), 'public_repo');
  assert.equal(JSON.stringify(started).includes(device.device_code), false);
  assert.equal(JSON.stringify(started).includes(token), false);
  f.advance();
  const connected = await f.runtime.poll(started.sessionId);
  assert.deepEqual(connected, { status: 'connected', login: 'fixture-owner' });
  assert.deepEqual(f.calls.accounts, [{ login: 'fixture-owner', scopes: 'public_repo' }]);
  assert.deepEqual(f.calls.saved, [token]);
  assert.equal((await f.runtime.poll(started.sessionId)).status, 'expired');
});

test('unconfigured OAuth and rejected native consent make no HTTP request', async () => {
  const unconfigured = fixture({ clientId: '' });
  assert.deepEqual(await unconfigured.runtime.start(), { configured: false });
  const refused = fixture({ confirmStart: async () => false });
  assert.equal((await refused.runtime.start('repo')).cancelled, true);
  assert.equal(refused.calls.network.length, 0);
  assert.equal(refused.stored(), 'previous-token');
  const refusedCode = fixture({ confirmDeviceCode: async () => false,
    openVerification: async () => assert.fail('Refused code must never open a browser') });
  assert.equal((await refusedCode.runtime.start()).cancelled, true);
  assert.equal(refusedCode.calls.saved.length, 0);
});

test('private scope requires explicit selection and accepts only its implied permissions', async () => {
  const f = fixture({ fetchImpl: async (url, options) => {
    if (url.endsWith('/device/code')) { assert.equal(options.body.get('scope'), 'repo'); return response(device); }
    if (url.endsWith('/oauth/access_token')) return response({ ...grant, scope: 'repo' });
    return response({ login: 'fixture-owner' }, 200, 'repo');
  } });
  const started = await f.runtime.start('repo');
  f.advance();
  assert.equal((await f.runtime.poll(started.sessionId)).status, 'connected');
  assert.equal(f.calls.starts[0].scope, 'repo');
  assert.equal((await f.runtime.start('admin:org')).error, 'Nepovolený GitHub scope.');
});

test('unexpected scopes, malformed grants and invalid accounts never replace stored credentials', async () => {
  for (const invalid of [{ ...grant, scope: 'repo' }, { ...grant, scope: 'public_repo,workflow' },
    { ...grant, token_type: 'mac' }, { ...grant, access_token: 'header\ninjection' }, { ...grant, scope: undefined }]) {
    const f = fixture({ fetchImpl: async (url) => url.endsWith('/device/code') ? response(device) : response(invalid) });
    const started = await f.runtime.start(); f.advance();
    assert.equal((await f.runtime.poll(started.sessionId)).status, 'error');
    assert.equal(f.calls.saved.length, 0);
    assert.equal(f.stored(), 'previous-token');
  }
  for (const [status, account, scopes] of [[401, {}, 'public_repo'], [200, null, 'public_repo'], [200, {}, 'public_repo'], [200, { login: 'owner' }, 'repo'], [200, { login: 'owner' }, null]]) {
    const f = fixture({ fetchImpl: async (url) => url.endsWith('/device/code') ? response(device)
      : url.endsWith('/oauth/access_token') ? response(grant) : response(account, status, scopes) });
    const started = await f.runtime.start(); f.advance();
    assert.equal((await f.runtime.poll(started.sessionId)).status, 'error');
    assert.equal(f.calls.saved.length, 0);
  }
});

test('refusing the verified account preserves the previous token', async () => {
  const f = fixture({ confirmAccount: async () => false });
  const started = await f.runtime.start(); f.advance();
  assert.equal((await f.runtime.poll(started.sessionId)).status, 'cancelled');
  assert.equal(f.stored(), 'previous-token');
  assert.equal(f.calls.saved.length, 0);
});

test('polling is single-flight and respects pending and slow_down on the main-process clock', async () => {
  const pending = deferred(); let polls = 0;
  const f = fixture({ fetchImpl: async (url) => {
    if (url.endsWith('/device/code')) return response(device);
    polls += 1;
    return pending.promise;
  } });
  const started = await f.runtime.start();
  assert.equal((await f.runtime.poll(started.sessionId)).status, 'pending');
  assert.equal(polls, 0);
  f.advance(); const first = f.runtime.poll(started.sessionId);
  f.advance(30000); const second = f.runtime.poll(started.sessionId);
  assert.equal(first, second); assert.equal(polls, 1);
  pending.resolve(response({ error: 'slow_down' }));
  assert.deepEqual(await first, { status: 'pending', intervalSeconds: 10 });
  f.advance(9999); await f.runtime.poll(started.sessionId); assert.equal(polls, 1);
  f.advance(1); await f.runtime.poll(started.sessionId); assert.equal(polls, 2);
});

test('a second start cannot replace an ongoing native consent or expose a second device code', async () => {
  const consent = deferred(); const f = fixture({ confirmStart: () => consent.promise });
  const first = f.runtime.start();
  assert.match((await f.runtime.start()).error, /probíhá/);
  assert.match((await f.runtime.connectToken()).error, /probíhá/);
  f.runtime.cancel(); consent.resolve(true);
  assert.equal((await first).cancelled, true);
  assert.equal(f.calls.network.length, 0);
});

test('disconnect aborts a pending exchange and rejects its eventual successful response', async () => {
  const pending = deferred(); let signal;
  const f = fixture({ fetchImpl: async (url, options) => {
    if (url.endsWith('/device/code')) return response(device);
    signal = options.signal; return pending.promise;
  } });
  const started = await f.runtime.start(); f.advance();
  const poll = f.runtime.poll(started.sessionId);
  await f.runtime.disconnect(); assert.equal(signal.aborted, true);
  pending.resolve(response(grant));
  assert.equal((await poll).status, 'expired');
  assert.equal(f.calls.saved.length, 0); assert.equal(f.stored(), null);
});

test('expiry and cancel while verifying an account reject late completion', async () => {
  for (const stop of ['expire', 'cancel']) {
    const account = deferred(); const entered = deferred();
    const f = fixture({ fetchImpl: async (url) => {
      if (url.endsWith('/device/code')) return response(device);
      if (url.endsWith('/oauth/access_token')) return response(grant);
      entered.resolve(); return account.promise;
    } });
    const started = await f.runtime.start(); f.advance(); const poll = f.runtime.poll(started.sessionId);
    await entered.promise;
    if (stop === 'expire') f.advance(900000); else f.runtime.cancel(started.sessionId);
    account.resolve(response({ login: 'fixture-owner' }));
    assert.equal((await poll).status, 'expired'); assert.equal(f.calls.saved.length, 0);
  }
});

test('cancel during persistence restores the old token and disconnect deletes after an in-flight save', async () => {
  for (const stop of ['cancel', 'disconnect']) {
    const saved = deferred(); const entered = deferred(); let stored = 'previous-token';
    const f = fixture({ loadToken: async () => stored, deleteToken: async () => { stored = null; },
      saveToken: async (value) => { if (value === token) { entered.resolve(); await saved.promise; } stored = value; } });
    const started = await f.runtime.start(); f.advance(); const poll = f.runtime.poll(started.sessionId);
    await entered.promise;
    const stopped = stop === 'disconnect' ? f.runtime.disconnect() : f.runtime.cancel(started.sessionId);
    saved.resolve(); await stopped;
    assert.equal((await poll).status, 'expired');
    assert.equal(stored, stop === 'disconnect' ? null : 'previous-token');
  }
});

test('cancel during account consent cannot reconnect and stale cancellation cannot end a new session', async () => {
  const consent = deferred(); const entered = deferred();
  const f = fixture({ confirmAccount: async () => { entered.resolve(); return consent.promise; } });
  const started = await f.runtime.start(); f.advance(); const poll = f.runtime.poll(started.sessionId);
  await entered.promise; f.runtime.cancel(started.sessionId);
  const next = await f.runtime.start(); f.runtime.cancel(started.sessionId);
  consent.resolve(true); assert.equal((await poll).status, 'expired');
  assert.equal((await f.runtime.poll(next.sessionId)).status, 'pending');
  assert.equal(f.calls.saved.length, 0);
});

test('manual token validation and consent use the same cancellation boundary', async () => {
  const entered = deferred(); const account = deferred();
  const f = fixture({ fetchImpl: async () => { entered.resolve(); return account.promise; } });
  const connect = f.runtime.connectToken(); await entered.promise;
  await f.runtime.disconnect(); account.resolve(response({ login: 'fixture-owner' }));
  assert.equal((await connect).connected, false); assert.equal(f.stored(), null);
  const good = fixture(); assert.equal((await good.runtime.connectToken()).login, 'fixture-owner');
  assert.equal(good.calls.accounts.length, 1); assert.equal(good.stored(), token);
});

test('errors cannot reflect a token and an old rejected API request cannot delete a replacement token', async () => {
  const f = fixture({ fetchImpl: async () => { throw new Error(`secret: ${token}`); } });
  const result = await f.runtime.connectToken();
  assert.equal(result.error.includes(token), false);
  const good = fixture(); await good.runtime.connectToken();
  await good.runtime.dropRejectedToken('previous-token'); assert.equal(good.stored(), token);
  await good.runtime.dropRejectedToken(token); assert.equal(good.stored(), null);
});
