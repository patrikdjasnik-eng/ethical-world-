const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { stopBackendProcess } = require("../electron/backend-process.cjs");

function child() {
  const process = new EventEmitter();
  Object.assign(process, { pid: 1234, exitCode: null, signalCode: null, stdin: { end() {} }, kill() {} });
  return process;
}

test("backend shutdown closes parent pipe and waits for graceful exit", async () => {
  const process = child();
  let ended = 0;
  process.stdin.end = () => { ended++; queueMicrotask(() => { process.exitCode = 0; process.emit("exit", 0); }); };
  const options = { platform: "win32", timeoutMs: 10, execute: () => assert.fail("Graceful exit must not terminate a tree") };
  await Promise.all([stopBackendProcess(process, options), stopBackendProcess(process, options)]);
  assert.equal(ended, 1);
});

test("Windows fallback targets only the owned PID and its descendants", async () => {
  const process = child();
  let invocation;
  await stopBackendProcess(process, { platform: "win32", timeoutMs: 1, execute(command, args, options, callback) {
    invocation = { command, args, options };
    callback(null);
  } });
  assert.equal(invocation.command, "taskkill.exe");
  assert.deepEqual(invocation.args, ["/PID", "1234", "/T", "/F"]);
  assert.equal(invocation.options.windowsHide, true);
});

test("already exited backend is never terminated", async () => {
  const process = child(); process.exitCode = 0;
  process.stdin.end = () => assert.fail("Already closed");
  await stopBackendProcess(process, { execute: () => assert.fail("Already exited") });
});

test("Forge isolates the selected output and excludes prior builds and local secrets", () => {
  const old = process.env.ETHICAL_WORLD_BUILD_DIR;
  process.env.ETHICAL_WORLD_BUILD_DIR = "out/updates/fixture";
  try {
    const config = require("../forge.config.cjs");
    assert.equal(config.outDir, "out/updates/fixture");
    for (const path of ["/out/Ethical World-win32-x64/resources/backend", "/.venv/Scripts/python.exe", "/resources/backend/old.exe", "/.env", "/.env.local"]) {
      assert.ok(config.packagerConfig.ignore.some((rule) => rule.test(path)), path);
    }
    assert.ok(!config.packagerConfig.ignore.some((rule) => rule.test("/dist/index.html")));
    assert.ok(!config.packagerConfig.ignore.some((rule) => rule.test("/electron/main.cjs")));
  } finally {
    if (old === undefined) delete process.env.ETHICAL_WORLD_BUILD_DIR;
    else process.env.ETHICAL_WORLD_BUILD_DIR = old;
  }
});
