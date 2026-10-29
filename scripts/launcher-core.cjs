const fs = require('node:fs/promises');
const fsSync = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFile, spawn } = require('node:child_process');
const { promisify } = require('node:util');

const execute = promisify(execFile);
const repository = 'patrikdjasnik-eng/ethical-world-';
const gitEnvironment = {
  ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never',
  GIT_SSH_COMMAND: 'ssh -oBatchMode=yes -oConnectTimeout=15',
};

function remoteIdentity(value) {
  const normalized = String(value).trim().replace(/\.git$/, '');
  if (normalized === `https://github.com/${repository}` || normalized === `git@github.com:${repository}` ||
      normalized === `ssh://git@github.com/${repository}`) return repository;
  throw new Error('Origin musi odkazovat na patrikdjasnik-eng/ethical-world- bez tokenu v URL.');
}

async function git(repoPath, argumentsList, options = {}) {
  try {
    const result = await execute('git', ['-c', 'credential.interactive=false', '-C', repoPath, ...argumentsList], {
      env: gitEnvironment, windowsHide: true, timeout: 30000, signal: options.signal, maxBuffer: 1024 * 1024,
    });
    return result.stdout.trim();
  } catch {
    // Remote diagnostics can contain credential URLs; keep them out of launcher logs.
    throw new Error('Git operace selhala. Zkontroluj sit a pristup k repozitari v Git Credential Manageru.');
  }
}

async function syncRepository(config, options = {}) {
  const executeGit = options.git ?? git;
  const verifyRemote = options.verifyRemote ?? remoteIdentity;
  const controller = new AbortController();
  const timeoutMs = options.checkTimeoutMs ?? 8000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const runGit = async (root, args) => {
    controller.signal.throwIfAborted();
    const startedAt = Date.now();
    options.status?.('checking', args[0] === 'fetch' ? 'Kontroluji zmeny na GitHubu...' : args[0] === 'merge' ? 'Stahuji nove zmeny...' : 'Kontroluji lokalni repozitar...');
    try {
      const result = await executeGit(root, args, { signal: controller.signal });
      controller.signal.throwIfAborted();
      return result;
    } finally { options.log?.(`Git ${args[0]}: ${Date.now() - startedAt} ms\n`); }
  };
  try {
    const branch = await runGit(config.repoPath, ['branch', '--show-current']);
    if (branch !== config.branch) throw new Error(`Repozitar musi byt na vetvi ${config.branch}. Launcher vetve neprepina.`);
    verifyRemote(await runGit(config.repoPath, ['remote', 'get-url', 'origin']));
    if (await runGit(config.repoPath, ['status', '--porcelain', '--untracked-files=normal'])) {
      throw new Error('Repozitar obsahuje lokalni zmeny. Uloz je commitem nebo je vyres pred aktualizaci.');
    }
    await runGit(config.repoPath, ['fetch', '--no-tags', '--no-recurse-submodules', 'origin', `refs/heads/${config.branch}`]);
    const [ahead, behind] = (await runGit(config.repoPath, ['rev-list', '--left-right', '--count', 'HEAD...FETCH_HEAD'])).split(/\s+/).map(Number);
    if (!Number.isInteger(ahead) || !Number.isInteger(behind) || ahead !== 0) {
      throw new Error('Lokalni historie obsahuje vlastni commity nebo se rozesla s GitHubem. Launcher ji neprepise.');
    }
    // Do not interrupt a working-tree mutation after the read-only check succeeds.
    clearTimeout(timer);
    if (behind > 0) await runGit(config.repoPath, ['merge', '--ff-only', 'FETCH_HEAD']);
    const commit = await runGit(config.repoPath, ['rev-parse', 'HEAD']);
    if (!/^[a-f0-9]{40,64}$/.test(commit)) throw new Error('Git nevratil platny commit.');
    return commit;
  } catch (error) {
    if (controller.signal.aborted) throw new Error('Kontrola Gitu prekrocila casovy limit. Aktualizaci zkusim pri dalsim spusteni.');
    throw error;
  } finally { clearTimeout(timer); }
}

function buildVersion(baseVersion, commitCount) {
  if (!/^\d+\.\d+\.\d+$/.test(baseVersion) || !Number.isSafeInteger(commitCount) || commitCount < 1) {
    throw new Error('Desktop build potrebuje stabilni verzi a uplnou Git historii.');
  }
  const parts = baseVersion.split('.').map(Number);
  parts[2] += commitCount;
  if (parts.some((part) => part > 65535)) throw new Error('Verze prekrocila limit Windows. Navys minor verzi balicku.');
  return parts.join('.');
}

async function packageVersion(repoPath) {
  if (await git(repoPath, ['rev-parse', '--is-shallow-repository']) !== 'false') {
    throw new Error('Launcher potrebuje plnou Git historii; shallow clone nelze automaticky verzovat.');
  }
  const packageJson = JSON.parse(await fs.readFile(path.join(repoPath, 'package.json'), 'utf8'));
  return buildVersion(packageJson.version, Number(await git(repoPath, ['rev-list', '--count', 'HEAD'])));
}

async function writeJson(filePath, value) {
  const temporaryPath = `${filePath}.${crypto.randomUUID()}.tmp`;
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  try {
    await fs.writeFile(temporaryPath, JSON.stringify(value, null, 2), 'utf8');
    await fs.rename(temporaryPath, filePath);
  } finally {
    await fs.rm(temporaryPath, { force: true });
  }
}

async function readJson(filePath) {
  try { return JSON.parse(await fs.readFile(filePath, 'utf8')); } catch { return null; }
}

async function installedExecutable(installRoot, version) {
  if (!/^\d+\.\d+\.\d+$/.test(String(version))) return null;
  const executable = path.join(installRoot, `app-${version}`, 'EthicalWorld.exe');
  try {
    if ((await fs.stat(executable)).isFile() &&
        (await fs.stat(path.join(installRoot, `app-${version}`, 'resources', 'backend', 'EthicalWorldBackend.exe'))).isFile()) return executable;
  } catch { /* Missing/incomplete installations are not launch candidates. */ }
  return null;
}

async function lastInstallation(installRoot, state) {
  const known = await installedExecutable(installRoot, state?.version);
  if (known) return { executable: known, version: state.version };
  let entries;
  try { entries = await fs.readdir(installRoot); } catch { return null; }
  const versions = entries.filter((entry) => /^app-\d+\.\d+\.\d+$/.test(entry)).map((entry) => entry.slice(4));
  versions.sort((left, right) => {
    const a = left.split('.').map(Number); const b = right.split('.').map(Number);
    return b[0] - a[0] || b[1] - a[1] || b[2] - a[2];
  });
  for (const version of versions) {
    const executable = await installedExecutable(installRoot, version);
    if (executable) return { executable, version };
  }
  return null;
}

function powershellLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

async function powershell(config, script, timeoutMs = 30000) {
  return execute(config.powershellPath, ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], {
    windowsHide: true, timeout: timeoutMs, maxBuffer: 1024 * 1024,
  });
}

async function applicationRunning(config) {
  const result = await execute('tasklist.exe', ['/FI', 'IMAGENAME eq EthicalWorld.exe', '/FO', 'CSV', '/NH'], {
    windowsHide: true, timeout: 3000, maxBuffer: 1024 * 1024,
  });
  return /^"EthicalWorld\.exe",/im.test(result.stdout);
}

async function launchApplication(config, executable, allowExisting = false) {
  await powershell(config, `
    $ErrorActionPreference = 'Stop'
    $applicationPath = ${powershellLiteral(executable)}
    Start-Process -FilePath $applicationPath
    $launchDeadline = (Get-Date).AddSeconds(45)
    do {
      Start-Sleep -Milliseconds 300
      $startedApplication = Get-Process -Name EthicalWorld -ErrorAction SilentlyContinue |
        Where-Object { ${allowExisting ? '$true' : '($_.Path -eq $applicationPath)'} -and $_.MainWindowHandle -ne 0 } | Select-Object -First 1
    } while (-not $startedApplication -and (Get-Date) -lt $launchDeadline)
    if (-not $startedApplication) { throw 'Ethical World se nepodarilo spustit.' }
  `, 60000);
}

async function buildAndInstall(config, commit, version, receiptPath, log) {
  await new Promise((resolve, reject) => {
    const child = spawn(config.powershellPath, [
      '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path.join(config.repoPath, 'scripts', 'update-desktop.ps1'),
      '-NoLaunch', '-PackageVersion', version, '-ExpectedCommit', commit, '-ReceiptPath', receiptPath,
    ], { cwd: config.repoPath, windowsHide: true, env: { ...process.env, ETHICAL_WORLD_LAUNCHER_DIR: config.launcherDir } });
    child.stdout.on('data', (chunk) => log(chunk.toString()));
    child.stderr.on('data', (chunk) => log(chunk.toString()));
    child.once('error', () => reject(new Error('Aktualizacni proces se nepodarilo spustit.')));
    child.once('close', (code) => code === 0 ? resolve() : reject(new Error('Testy, build nebo instalace selhaly. Podrobnosti jsou v logu launcheru.')));
  });
}

async function runLauncher(config, options = {}) {
  const emit = options.status ?? (() => {});
  const log = options.log ?? (() => {});
  const isRunning = options.isRunning ?? applicationRunning;
  const launch = options.launch ?? launchApplication;
  const update = options.update ?? buildAndInstall;
  const statePath = path.join(config.launcherDir, 'last-install.json');
  const state = await readJson(statePath);
  const previous = await lastInstallation(config.installRoot, state);
  const newestInstallation = await lastInstallation(config.installRoot, null);
  try {
    const checkStartedAt = Date.now();
    emit('checking', 'Kontroluji aktualizace Ethical World...');
    const running = await isRunning(config);
    log(`Kontrola bezici aplikace: ${Date.now() - checkStartedAt} ms\n`);
    if (running) {
      if (!previous) throw new Error('Aplikace bezi, ale jeji instalace nebyla nalezena.');
      await launch(config, previous.executable, true);
      return { stage: 'ready', message: 'Ethical World uz bezi. Prepinam do aplikace.' };
    }
    const commit = await syncRepository(config, options);
    if (state?.commit === commit && state.repoPath === config.repoPath && previous?.version === state.version) {
      emit('launching', 'Mas aktualni verzi. Oteviram Ethical World...');
      await launch(config, previous.executable);
      return { stage: 'ready', message: 'Ethical World je aktualni.' };
    }
    const version = await packageVersion(config.repoPath);
    // A manual installation may already have a higher version; never downgrade it.
    if (newestInstallation && newestInstallation.version.split('.').map(Number).some((part, index, values) => {
      const target = version.split('.').map(Number);
      return values.slice(0, index).every((value, prior) => value === target[prior]) && part > target[index];
    })) throw new Error('Nainstalovana verze je novejsi nez tato vetev. Aktualizaci preskakuji.');
    emit('updating', `Pripravuji verzi ${version}. Testy a sestaveni mohou trvat nekolik minut...`);
    const receiptPath = path.join(config.launcherDir, `receipt-${crypto.randomUUID()}.json`);
    let receipt;
    try {
      await update(config, commit, version, receiptPath, log);
      receipt = await readJson(receiptPath);
    } finally { await fs.rm(receiptPath, { force: true }); }
    const executable = await installedExecutable(config.installRoot, version);
    if (!executable || receipt?.commit !== commit || receipt.version !== version) {
      throw new Error('Instalace nevratila overene potvrzeni pro tento Git commit.');
    }
    emit('launching', 'Aktualizace dokoncena. Oteviram Ethical World...');
    await launch(config, executable);
    try {
      await writeJson(statePath, { commit, version, repoPath: config.repoPath, installedAt: new Date().toISOString() });
    } catch {
      return { stage: 'warning', message: 'Ethical World je spusteny, ale potvrzeni instalace se nepodarilo ulozit. Pristi start muze zopakovat build.' };
    }
    return { stage: 'ready', message: `Ethical World ${version} je pripraveny.` };
  } catch (error) {
    log(`\n${error.message}\n`);
    if (previous && await installedExecutable(config.installRoot, previous.version)) {
      emit('fallback', 'Aktualizace nebyla dokoncena. Oteviram posledni dostupnou instalaci...');
      try {
        await launch(config, previous.executable);
        return { stage: 'warning', message: `${error.message}\nSpustena posledni dostupna verze ${previous.version}.` };
      } catch { /* Report a failed fallback instead of claiming a successful launch. */ }
    }
    return { stage: 'error', message: `${error.message}\nFunkcni instalaci se nepodarilo spustit. Otevri log.` };
  }
}

async function acquireLock(launcherDir) {
  const lockPath = path.join(launcherDir, 'worker.lock');
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const handle = await fs.open(lockPath, 'wx');
      await handle.writeFile(JSON.stringify({ pid: process.pid }));
      return async () => { await handle.close(); await fs.rm(lockPath, { force: true }); };
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      const lock = await readJson(lockPath);
      if (!Number.isInteger(lock?.pid) || lock.pid < 1) throw new Error('Neplatny zamek launcheru. Zkontroluj worker.lock.');
      try { process.kill(lock.pid, 0); } catch (probeError) {
        if (probeError.code === 'ESRCH') { await fs.rm(lockPath, { force: true }); continue; }
      }
      throw new Error('Aktualizace uz probiha v jinem launcheru.');
    }
  }
  throw new Error('Zamek launcheru se nepodarilo ziskat.');
}

async function main() {
  if (process.argv[2] === '--package-version') {
    process.stdout.write(await packageVersion(path.resolve(process.argv[3])));
    return;
  }
  if (process.platform !== 'win32') throw new Error('Desktop launcher funguje pouze na Windows.');
  const launcherDir = path.dirname(path.resolve(process.argv[2]));
  const config = await readJson(path.join(launcherDir, 'config.json'));
  if (!config || config.schemaVersion !== 1 || config.branch !== 'dev/first-runnable' || !path.isAbsolute(config.repoPath) ||
      !path.isAbsolute(config.installRoot) || !path.isAbsolute(config.powershellPath)) throw new Error('Neplatna konfigurace launcheru.');
  config.launcherDir = launcherDir;
  const release = await acquireLock(launcherDir);
  const logPath = path.join(launcherDir, 'launcher.log');
  const statusPath = path.join(launcherDir, 'status.json');
  const status = (stage, message) => {
    try {
      const temporaryPath = `${statusPath}.tmp`;
      fsSync.writeFileSync(temporaryPath, JSON.stringify({ stage, message }), 'utf8');
      fsSync.renameSync(temporaryPath, statusPath);
    } catch {
      // A transient reader/antivirus lock must not abort an install that is already running.
    }
  };
  try {
    fsSync.writeFileSync(logPath, `${new Date().toISOString()} Ethical World launcher\n`, 'utf8');
    const result = await runLauncher(config, { status, log: (value) => fsSync.appendFileSync(logPath, value, 'utf8') });
    status(result.stage, result.message);
    process.exitCode = result.stage === 'ready' ? 0 : 1;
  } finally { await release(); }
}

module.exports = { remoteIdentity, git, syncRepository, buildVersion, packageVersion, runLauncher, installedExecutable, lastInstallation, acquireLock, powershellLiteral };
if (require.main === module) main().catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
