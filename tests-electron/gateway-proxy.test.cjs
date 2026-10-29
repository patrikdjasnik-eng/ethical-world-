const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const http = require("node:http");
const crypto = require("node:crypto");
const vm = require("node:vm");
const { gatewayRequest } = require("../electron/backend-runtime.cjs");

const deadline = (promise) => Promise.race([promise, new Promise((_resolve, reject) => {
  const timer = setTimeout(() => reject(new Error("Stream was buffered or did not cancel.")), 2000);
  timer.unref();
})]);

test("the real Vite gateway relays the first event before final and cancels upstream", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "ethical-gateway-"));
  const previous = process.env.ETHICAL_WORLD_DATA_DIR;
  process.env.ETHICAL_WORLD_DATA_DIR = directory;
  const token = "fixture-gateway-capability-not-a-secret-0123456789";
  let release;
  let upstreamClosed;
  let streaming = 0;
  const backend = http.createServer((request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");
    if (url.pathname === "/health") return response.end(JSON.stringify({ proof: crypto.createHmac("sha256", token).update(url.searchParams.get("challenge")).digest("hex") }));
    assert.equal(request.headers["x-ethical-capability"], token);
    response.writeHead(200, { "Content-Type": "application/x-ndjson" });
    response.write('{"type":"start"}\n');
    streaming += 1;
    if (streaming === 1) release = () => response.end('{"type":"final","response":{"content":"done"}}\n');
    else response.once("close", () => upstreamClosed?.());
  });
  await new Promise((resolve) => backend.listen(0, "127.0.0.1", resolve));
  await fs.writeFile(path.join(directory, "runtime.json"), JSON.stringify({ token, port: backend.address().port }));
  const { createServer } = await import("vite");
  const root = path.resolve(__dirname, "..");
  const vite = await createServer({ root, configFile: path.join(root, "vite.config.ts"), logLevel: "silent", server: { port: 0 } });
  try {
    await vite.listen();
    const url = "http://127.0.0.1:" + vite.httpServer.address().port + "/api/chat/stream";
    const response = await deadline(fetch(url, { method: "POST", body: "{}" }));
    assert.equal(response.headers.get("content-type"), "application/x-ndjson");
    const reader = response.body.getReader();
    const first = await deadline(reader.read());
    assert.match(Buffer.from(first.value).toString(), /start/);
    assert.doesNotMatch(Buffer.from(first.value).toString(), /final/);
    release();
    assert.match(Buffer.from((await reader.read()).value).toString(), /final/);
    await reader.cancel();
    const closed = new Promise((resolve) => { upstreamClosed = resolve; });
    const controller = new AbortController();
    const second = await fetch(url, { method: "POST", body: "{}", signal: controller.signal });
    await second.body.getReader().read();
    controller.abort();
    await deadline(closed);
  } finally {
    release?.();
    await vite.close();
    backend.closeAllConnections();
    await new Promise((resolve) => backend.close(resolve));
    if (previous === undefined) delete process.env.ETHICAL_WORLD_DATA_DIR;
    else process.env.ETHICAL_WORLD_DATA_DIR = previous;
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test("ordinary desktop gateway cancellation closes the provider connection", async () => {
  const token = "fixture-capability";
  let entered, closed;
  const receiving = new Promise((resolve) => { entered = resolve; });
  const stopped = new Promise((resolve) => { closed = resolve; });
  const backend = http.createServer((request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");
    if (url.pathname === "/health") response.end(JSON.stringify({ proof: crypto.createHmac("sha256", token).update(url.searchParams.get("challenge")).digest("hex") }));
    else { response.once("close", closed); entered(); }
  });
  await new Promise((resolve) => backend.listen(0, "127.0.0.1", resolve));
  try {
    const controller = new AbortController();
    const task = gatewayRequest("http://127.0.0.1:" + backend.address().port, token, { path: "/api/chat", method: "POST", body: "{}" }, controller.signal);
    const rejected = assert.rejects(task, { name: "AbortError" });
    await deadline(receiving);
    controller.abort();
    await rejected;
    await deadline(stopped);
  } finally { backend.closeAllConnections(); await new Promise((resolve) => backend.close(resolve)); }
});

test("service worker copies before returning a consumable online response", async () => {
  const source = (await fs.readFile(path.join(__dirname, "..", "public", "sw.js"), "utf8")).replace("__CACHE_VERSION__", "fixture").replace("__PRECACHE_JSON__", "[]");
  let listener, outgoing, cached, open;
  const delayed = new Promise((resolve) => { open = resolve; });
  vm.runInNewContext(source, { URL, Response, fetch: async () => new Response("online body"), caches: { open: () => delayed }, self: { location: { origin: "https://fixture" }, addEventListener: (kind, callback) => { if (kind === "fetch") listener = callback; } } });
  listener({ request: { method: "GET", url: "https://fixture/asset.js", destination: "script" }, respondWith: (value) => { outgoing = value; }, waitUntil: (value) => { cached = value; } });
  assert.equal(await (await outgoing).text(), "online body");
  let stored;
  open({ put: async (_request, response) => { stored = await response.text(); } });
  await cached;
  assert.equal(stored, "online body");
});
