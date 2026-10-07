const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { createModelRuntime, localOllamaUrl } = require("../electron/model-runtime.cjs");

function fixture({ initiallyOnline = true, missing = false, failWarm = false } = {}) {
  let online = initiallyOnline;
  let spawns = 0;
  let warms = 0;
  let kills = 0;
  let warmBody;
  let spawnOptions;
  const child = Object.assign(new EventEmitter(), { pid: 1234, exitCode: null, signalCode: null });
  const runtime = createModelRuntime({ platform: "win32", startupMs: 50, warmupMs: 50,
    findExecutable: async () => "C:\\Ollama\\ollama.exe",
    fetcher: async (url, init) => {
      assert.ok(url.startsWith("http://127.0.0.1:11434/"));
      if (!online) throw new Error("offline");
      if (url.endsWith("/api/tags")) return Response.json({ models: missing ? [] : [{ name: "masa-cyber:latest" }] });
      warms++; warmBody = JSON.parse(init.body);
      if (failWarm) throw new Error("load failed");
      return Response.json({ done: true });
    },
    spawnProcess(command, args, options) {
      assert.equal(command, "C:\\Ollama\\ollama.exe");
      assert.deepEqual(args, ["serve"]);
      spawns++; spawnOptions = options; online = true; return child;
    },
    execute(command, args, options, callback) {
      assert.equal(command, "taskkill.exe");
      assert.deepEqual(args, ["/PID", "1234", "/T", "/F"]);
      kills++; child.exitCode = 0; callback(null);
    }
  });
  return { runtime, values: () => ({ spawns, warms, kills, warmBody, spawnOptions }) };
}
const request = { model: "masa-cyber", baseUrl: "http://localhost:11434" };

test("model start accepts only the supported loopback service", () => {
  for (const url of ["https://localhost:11434", "http://evil.test:11434", "http://127.0.0.1:1234", "http://localhost:11434/a", "http://user@localhost:11434", "http://localhost:11434?key=secret"]) assert.equal(localOllamaUrl(url), false);
  assert.equal(localOllamaUrl("http://127.0.0.1:11434"), true);
});

test("an existing server is reused; concurrent aliases warm once and are never killed", async () => {
  const { runtime, values } = fixture();
  try {
    const results = await Promise.all([runtime.ensure(request), runtime.ensure({ ...request, model: "masa-cyber:latest" })]);
    assert.ok(results.every((result) => result.state === "ready"));
    assert.equal(results[0].model, "masa-cyber:latest");
    assert.equal((await runtime.ensure(request)).state, "ready");
    assert.equal(values().warms, 1);
    assert.equal(values().spawns, 0);
    assert.deepEqual(values().warmBody, { model: "masa-cyber:latest", stream: false, keep_alive: "15m" });
  } finally { await runtime.stop(); }
  assert.equal(values().kills, 0);
});

test("an offline server is started once with loopback binding; only its PID is stopped", async () => {
  const { runtime, values } = fixture({ initiallyOnline: false });
  await Promise.all([runtime.ensure(request), runtime.ensure(request)]);
  assert.equal(values().spawns, 1);
  assert.equal(values().spawnOptions.env.OLLAMA_HOST, "127.0.0.1:11434");
  await runtime.stop();
  assert.equal(values().kills, 1);
});

test("foreground preparation starts one server and validates the model without empty generation", async () => {
  const { runtime, values } = fixture({ initiallyOnline: false, failWarm: true });
  try {
    const results = await Promise.all([runtime.ensure({ ...request, warmup: false }), runtime.ensure({ ...request, model: "masa-cyber:latest", warmup: false })]);
    assert.ok(results.every((result) => result.state === "ready" && result.model === "masa-cyber:latest"));
    assert.equal(values().spawns, 1);
    assert.equal(values().warms, 0);
  } finally { await runtime.stop(); }
});

test("a foreground check does not wait for an explicit warmup already in flight", async () => {
  let release;
  let started;
  const waiting = new Promise((resolve) => { started = resolve; });
  const gate = new Promise((resolve) => { release = resolve; });
  let warmCalls = 0;
  const runtime = createModelRuntime({ fetcher: async (url) => {
    if (url.endsWith("/api/tags")) return Response.json({ models: [{ name: "masa-cyber:latest" }] });
    warmCalls++;
    started();
    await gate;
    return Response.json({ done: true });
  } });
  const warm = runtime.ensure(request);
  let deadline;
  try {
    await waiting;
    const result = await Promise.race([
      runtime.ensure({ ...request, warmup: false }),
      new Promise((_, reject) => { deadline = setTimeout(() => reject(new Error("Foreground check waited for warmup")), 500); })
    ]);
    assert.equal(result.state, "ready");
    assert.equal(warmCalls, 1);
  } finally {
    clearTimeout(deadline);
    release();
    await warm;
    await runtime.stop();
  }
});

test("foreground preparation still rejects a missing selected model", async () => {
  const { runtime, values } = fixture({ missing: true });
  try {
    assert.equal((await runtime.ensure({ ...request, warmup: false })).state, "missing");
    assert.equal(values().warms, 0);
  } finally { await runtime.stop(); }
});

test("a missing model is reported without downloading or substituting a model", async () => {
  const { runtime, values } = fixture({ missing: true });
  assert.equal((await runtime.ensure(request)).state, "missing");
  assert.equal(values().warms, 0);
  await runtime.stop();
});

test("failed warmup is retryable and closing prevents another start", async () => {
  const { runtime, values } = fixture({ failWarm: true });
  assert.equal((await runtime.ensure(request)).state, "error");
  assert.equal((await runtime.ensure(request)).state, "error");
  assert.equal(values().warms, 2);
  await runtime.stop();
  assert.equal((await runtime.ensure(request)).state, "error");
});
