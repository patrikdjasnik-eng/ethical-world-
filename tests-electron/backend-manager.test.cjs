const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { createBackendManager } = require("../electron/backend-manager.cjs");

const token = "runtime-capability-for-backend-manager-tests";
function fixture({ readyAfter = 0, failFirst = false, wrongProof = false, onPause } = {}) {
  let clock = 0;
  let readyAt = Infinity;
  const children = [];
  const stops = [];
  const logs = [];
  const runtime = createBackendManager({
    token, env: { TEST_API_KEY: "diagnostic-secret" }, now: () => clock,
    pause: async (ms) => { if (onPause) await onPause(); clock += ms; },
    getCandidates: () => [{ source: "bundled", command: "fixture.exe", args: [], cwd: "/fixture" }],
    verify: async (url, supplied) => {
      assert.equal(url, "http://127.0.0.1:8787");
      assert.equal(supplied, token);
      return !wrongProof && children.at(-1)?.exitCode === null && clock >= readyAt;
    },
    spawnProcess(command, args, options) {
      assert.equal(command, "fixture.exe");
      assert.deepEqual(args, []);
      assert.deepEqual(options.stdio, ["pipe", "ignore", "pipe"]);
      assert.equal(options.env.ETHICAL_WORLD_RUNTIME_TOKEN, token);
      assert.equal(options.env.ETHICAL_WORLD_PARENT_PIPE, "1");
      const child = Object.assign(new EventEmitter(), { pid: 100 + children.length, exitCode: null, signalCode: null, stdin: new EventEmitter(), stderr: new EventEmitter() });
      children.push(child);
      readyAt = clock + readyAfter;
      queueMicrotask(() => {
        child.emit("spawn");
        if (failFirst && children.length === 1) {
          child.stderr.emit("data", Buffer.from("Import failed: " + token.slice(0, 12)));
          child.stderr.emit("data", Buffer.from(token.slice(12) + " diagnostic-secret"));
          child.exitCode = 1;
          child.emit("exit", 1, null);
        }
      });
      return child;
    },
    stopProcess: async (child) => {
      if (child.exitCode !== null) return;
      stops.push(child.pid);
      child.exitCode = 0;
      child.emit("exit", 0, null);
    },
    writeLog: async (events) => { logs.push(JSON.stringify(events)); }
  });
  return { runtime, children, stops, logs, time: () => clock };
}

test("a cold backend can become ready after the old nine-second startup limit", async () => {
  const f = fixture({ readyAfter: 12000 });
  try {
    assert.equal((await f.runtime.ensure()).state, "ready");
    assert.ok(f.time() >= 12000);
    assert.equal(f.children.length, 1);
    assert.equal(f.stops.length, 0);
  } finally { await f.runtime.stop(); }
});

test("initial start, panel preparation and chat share one owned backend", async () => {
  const f = fixture();
  try {
    const results = await Promise.all([f.runtime.ensure(), f.runtime.ensure(), f.runtime.ensure()]);
    assert.ok(results.every((result) => result.state === "ready"));
    assert.equal((await f.runtime.ensure()).state, "ready");
    assert.equal(f.children.length, 1);
  } finally { await f.runtime.stop(); }
  assert.deepEqual(f.stops, [100]);
});

test("a failed startup is retryable and diagnostics do not expose runtime or API secrets", async () => {
  const f = fixture({ failFirst: true });
  try {
    const failure = await f.runtime.ensure();
    assert.equal(failure.state, "error");
    assert.match(failure.message, /kód 1/);
    assert.equal(f.time(), 0);
    const log = f.logs.join("\n");
    assert.match(log, /Import failed/);
    assert.ok(!log.includes(token));
    assert.ok(!log.includes("diagnostic-secret"));
    assert.equal((await f.runtime.ensure()).state, "ready");
    assert.equal(f.children.length, 2);
  } finally { await f.runtime.stop(); }
});

test("an exited owned backend is restarted on demand", async () => {
  const f = fixture();
  try {
    await f.runtime.ensure();
    f.children[0].exitCode = 1;
    f.children[0].emit("exit", 1, null);
    assert.equal((await f.runtime.status()).backendOnline, false);
    assert.equal((await f.runtime.ensure()).state, "ready");
    assert.equal(f.children.length, 2);
  } finally { await f.runtime.stop(); }
});

test("an unverified service never counts as ready and only the owned child is stopped", async () => {
  const f = fixture({ wrongProof: true });
  const failure = await f.runtime.ensure();
  assert.equal(failure.state, "error");
  assert.match(failure.message, /8787/);
  assert.deepEqual(f.stops, [100]);
  await f.runtime.stop();
  assert.deepEqual(f.stops, [100]);
});

test("closing prevents later starts", async () => {
  const f = fixture();
  await f.runtime.stop();
  assert.equal((await f.runtime.ensure()).state, "error");
  assert.equal(f.children.length, 0);
});

test("closing during startup stops the owned child once and never reports ready", async () => {
  let entered;
  let release;
  const waiting = new Promise((resolve) => { entered = resolve; });
  const gate = new Promise((resolve) => { release = resolve; });
  const f = fixture({ readyAfter: 12000, onPause: async () => { entered(); await gate; } });
  const start = f.runtime.ensure();
  await waiting;
  const stop = f.runtime.stop();
  release();
  await stop;
  assert.equal((await start).state, "error");
  assert.equal((await f.runtime.status()).backendOnline, false);
  assert.deepEqual(f.stops, [100]);
});
