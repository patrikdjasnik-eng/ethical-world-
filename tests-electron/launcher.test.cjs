const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { remoteIdentity, buildVersion, runLauncher, acquireLock, powershellLiteral } = require('../scripts/launcher-core.cjs');

const execute = promisify(execFile);
async function git(argumentsList) {
  return (await execute('git', ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.test', ...argumentsList])).stdout.trim();
}

async function installation(root, version) {
  const directory = path.join(root, `app-${version}`);
  await fs.mkdir(path.join(directory, 'resources', 'backend'), { recursive: true });
  await fs.writeFile(path.join(directory, 'EthicalWorld.exe'), 'fixture');
  await fs.writeFile(path.join(directory, 'resources', 'backend', 'EthicalWorldBackend.exe'), 'fixture');
}

async function fixture(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "ethical launcher's "));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const origin = path.join(directory, 'origin.git');
  const source = path.join(directory, 'source');
  const repoPath = path.join(directory, 'checkout');
  await git(['init', '--bare', origin]);
  await git(['init', '-b', 'dev/first-runnable', source]);
  await fs.writeFile(path.join(source, 'package.json'), JSON.stringify({ version: '0.1.1' }));
  await git(['-C', source, 'add', '.']);
  await git(['-C', source, 'commit', '-m', 'Initial fixture']);
  await git(['-C', source, 'remote', 'add', 'origin', origin]);
  await git(['-C', source, 'push', 'origin', 'dev/first-runnable']);
  await git(['clone', '--branch', 'dev/first-runnable', origin, repoPath]);
  const config = { repoPath, branch: 'dev/first-runnable', installRoot: path.join(directory, 'installed'), launcherDir: path.join(directory, 'launcher') };
  await fs.mkdir(config.launcherDir);
  await installation(config.installRoot, '0.1.1');
  const calls = { updates: [], launches: [], git: [] };
  const options = {
    isRunning: async () => false,
    verifyRemote: (url) => assert.equal(url, origin),
    git: async (root, args) => { calls.git.push(args); return git(['-C', root, ...args]); },
    launch: async (_config, executable) => { calls.launches.push(executable); },
    update: async (_config, commit, version, receiptPath) => {
      calls.updates.push({ commit, version });
      await installation(config.installRoot, version);
      await fs.writeFile(receiptPath, JSON.stringify({ commit, version }));
    },
  };
  return { directory, source, config, calls, options };
}

test('launcher builds once, skips an unchanged commit and fast-forwards a new commit', async (t) => {
  const { source, config, calls, options } = await fixture(t);
  assert.equal((await runLauncher(config, options)).stage, 'ready');
  assert.equal(calls.updates.length, 1);
  assert.equal(calls.updates[0].version, '0.1.2');
  assert.equal((await runLauncher(config, options)).stage, 'ready');
  assert.equal(calls.updates.length, 1);
  await fs.writeFile(path.join(source, 'note.md'), 'Remote update');
  await git(['-C', source, 'add', '.']);
  await git(['-C', source, 'commit', '-m', 'Remote change']);
  await git(['-C', source, 'push', 'origin', 'dev/first-runnable']);
  assert.equal((await runLauncher(config, options)).stage, 'ready');
  assert.equal(calls.updates.length, 2);
  assert.equal(calls.updates[1].version, '0.1.3');
  assert.equal(await fs.readFile(path.join(config.repoPath, 'note.md'), 'utf8'), 'Remote update');
  assert.equal(JSON.parse(await fs.readFile(path.join(config.repoPath, 'package.json'))).version, '0.1.1');
});

test('dirty files are preserved and the previous installation opens without fetching', async (t) => {
  const { config, calls, options } = await fixture(t);
  await fs.writeFile(path.join(config.repoPath, 'package.json'), '{"version":"0.1.1","local":true}');
  const result = await runLauncher(config, options);
  assert.equal(result.stage, 'warning');
  assert.equal(calls.updates.length, 0);
  assert.ok(!calls.git.some((args) => args[0] === 'fetch'));
  assert.equal(JSON.parse(await fs.readFile(path.join(config.repoPath, 'package.json'))).local, true);
  assert.match(calls.launches[0], /app-0\.1\.1/);
});

test('divergent local commits are never merged, reset or built automatically', async (t) => {
  const { source, config, calls, options } = await fixture(t);
  for (const root of [source, config.repoPath]) {
    await fs.writeFile(path.join(root, 'change.md'), root);
    await git(['-C', root, 'add', '.']);
    await git(['-C', root, 'commit', '-m', 'Separate history']);
  }
  await git(['-C', source, 'push', 'origin', 'dev/first-runnable']);
  const before = await git(['-C', config.repoPath, 'rev-parse', 'HEAD']);
  assert.equal((await runLauncher(config, options)).stage, 'warning');
  assert.equal(await git(['-C', config.repoPath, 'rev-parse', 'HEAD']), before);
  assert.equal(calls.updates.length, 0);
  assert.ok(!calls.git.some((args) => ['merge', 'reset', 'clean', 'stash'].includes(args[0])));
});

test('offline fetch and failed builds launch the old EXE and never mark the commit installed', async (t) => {
  const { config, calls, options } = await fixture(t);
  const runGit = options.git;
  options.git = async (root, args) => {
    if (args[0] === 'fetch') throw new Error('Offline fixture');
    return runGit(root, args);
  };
  assert.equal((await runLauncher(config, options)).stage, 'warning');
  options.git = runGit;
  options.update = async () => { throw new Error('Build fixture failure'); };
  assert.equal((await runLauncher(config, options)).stage, 'warning');
  assert.equal(calls.launches.length, 2);
  await assert.rejects(fs.access(path.join(config.launcherDir, 'last-install.json')));
});

test('wrong receipts and launch failures do not advance the installed commit', async (t) => {
  const { config, calls, options } = await fixture(t);
  const update = options.update;
  options.update = async (...args) => { await update(...args); await fs.writeFile(args[3], JSON.stringify({ commit: 'wrong', version: args[2] })); };
  assert.equal((await runLauncher(config, options)).stage, 'warning');
  await assert.rejects(fs.access(path.join(config.launcherDir, 'last-install.json')));
  options.update = update;
  // Keep the old installation as the verified fallback even if the failed new one exists.
  await fs.writeFile(path.join(config.launcherDir, 'last-install.json'), JSON.stringify({ version: '0.1.1', commit: 'old', repoPath: config.repoPath }));
  options.launch = async (_config, executable) => {
    calls.launches.push(executable);
    if (!executable.includes('app-0.1.1')) throw new Error('New EXE failed');
  };
  assert.equal((await runLauncher(config, options)).stage, 'warning');
  assert.equal(JSON.parse(await fs.readFile(path.join(config.launcherDir, 'last-install.json'))).commit, 'old');
  assert.match(calls.launches.at(-1), /app-0\.1\.1/);
});

test('an already running application is focused without fetching or building', async (t) => {
  const { config, calls, options } = await fixture(t);
  options.isRunning = async () => true;
  assert.equal((await runLauncher(config, options)).stage, 'ready');
  assert.equal(calls.git.length, 0);
  assert.equal(calls.updates.length, 0);
});

test('missing installations report failure instead of claiming a fallback', async (t) => {
  const { config, options } = await fixture(t);
  await fs.rm(config.installRoot, { recursive: true });
  options.update = async () => { throw new Error('Build failed'); };
  assert.equal((await runLauncher(config, options)).stage, 'error');
});

test('worker lock rejects simultaneous updates and releases for the next launch', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'ethical-lock-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const release = await acquireLock(directory);
  await assert.rejects(acquireLock(directory), /probiha/);
  await release();
  await (await acquireLock(directory))();
});

test('version mapping increases across commits and remote validation rejects credential URLs', () => {
  assert.equal(buildVersion('0.1.1', 20), '0.1.21');
  assert.equal(buildVersion('0.1.1', 21), '0.1.22');
  assert.throws(() => buildVersion('0.1.1-beta', 20));
  assert.throws(() => buildVersion('0.1.1', 65535));
  for (const url of ['https://github.com/patrikdjasnik-eng/ethical-world-.git', 'git@github.com:patrikdjasnik-eng/ethical-world-.git']) assert.equal(remoteIdentity(url), 'patrikdjasnik-eng/ethical-world-');
  for (const url of ['https://token@github.com/patrikdjasnik-eng/ethical-world-.git', 'https://github.com/other/repo', 'https://github.com.evil.test/patrikdjasnik-eng/ethical-world-']) assert.throws(() => remoteIdentity(url));
  assert.equal(powershellLiteral("C:\\User's files\\app.exe"), "'C:\\User''s files\\app.exe'");
});

test('Forge and Packager apply the version to maker data and the staging copy without editing sources', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'ethical-version-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  await fs.writeFile(path.join(directory, 'package.json'), JSON.stringify({ version: '0.1.1' }));
  const stagedDirectory = path.join(directory, 'staged');
  await fs.mkdir(stagedDirectory);
  await fs.copyFile(path.join(directory, 'package.json'), path.join(stagedDirectory, 'package.json'));
  // Forge changes process-wide logging; isolate it from Node's test reporter.
  const script = `
    import fs from 'node:fs/promises';
    import path from 'node:path';
    import { pathToFileURL } from 'node:url';
    import { createRequire } from 'node:module';
    const require = createRequire(path.join(process.cwd(), 'package.json'));
    const directory = process.argv[1];
    const config = require(process.argv[2]);
    const forgeUtility = path.resolve(path.dirname(require.resolve('@electron-forge/core')), '..', 'util', 'read-package-json.js');
    const { readMutatedPackageJson } = await import(pathToFileURL(forgeUtility).href);
    const makerPackage = await readMutatedPackageJson(directory, { ...config, pluginInterface: { triggerMutatingHook: async (_name, value) => value } });
    const packagerUtility = path.join(path.dirname(require.resolve('@electron/packager')), 'platform.js');
    const { App } = await import(pathToFileURL(packagerUtility).href);
    await App.prototype.writeAppVersion.call({ opts: config.packagerConfig, originalResourcesAppDir: path.join(directory, 'staged') });
    await fs.writeFile(path.join(directory, 'maker-version.json'), JSON.stringify({ version: makerPackage.version, appVersion: config.packagerConfig.appVersion }));
  `;
  await execute(process.execPath, ['--input-type=module', '-e', script, directory, require.resolve('../forge.config.cjs')], {
    cwd: path.resolve(__dirname, '..'), env: { ...process.env, ETHICAL_WORLD_PACKAGE_VERSION: '0.1.99' }, timeout: 30000,
  });
  const versions = JSON.parse(await fs.readFile(path.join(directory, 'maker-version.json')));
  assert.deepEqual(versions, { version: '0.1.99', appVersion: '0.1.99' });
  assert.equal(JSON.parse(await fs.readFile(path.join(stagedDirectory, 'package.json'))).version, versions.version);
  assert.equal(JSON.parse(await fs.readFile(path.join(directory, 'package.json'))).version, '0.1.1');
});
