const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

test('PowerShell shortcut discovery preserves records through regex matching and snapshot indexing', (t) => {
  const projectRoot = path.resolve(__dirname, '..');
  const engines = process.platform === 'win32' ? ['powershell.exe', 'pwsh.exe'] : ['pwsh'];
  for (const engine of engines) {
    const result = spawnSync(engine, [
      '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
      '-File', path.join(projectRoot, 'scripts', 'test-desktop-scripts.ps1'),
    ], { cwd: os.tmpdir(), encoding: 'utf8', timeout: 30000 });
    if (result.error?.code === 'ENOENT') continue;
    assert.ifError(result.error);
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    const explicitResult = spawnSync(engine, [
      '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
      '-File', path.join(projectRoot, 'scripts', 'test-desktop-scripts.ps1'),
      '-InstallerScript', path.join(projectRoot, 'scripts', 'test-desktop-install.ps1'),
    ], { cwd: projectRoot, encoding: 'utf8', timeout: 30000 });
    assert.ifError(explicitResult.error);
    assert.equal(explicitResult.status, 0, `${explicitResult.stdout}\n${explicitResult.stderr}`);
    return;
  }
  t.skip('PowerShell is unavailable; run scripts/test-desktop-scripts.ps1 on Windows.');
});
