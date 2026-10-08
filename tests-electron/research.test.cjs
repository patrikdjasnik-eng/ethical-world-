const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { publicAddress, publicTarget, validateUrl, extractPage, collectPage } = require("../electron/research-fetch.cjs");
const { createResearchRuntime } = require("../electron/research-runtime.cjs");

test("research rejects private, mapped, metadata and ambiguous DNS addresses", async () => {
  for (const address of ["127.0.0.1", "0.0.0.0", "10.1.1.1", "172.16.1.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "::1", "::", "fc00::1", "fe80::1", "::ffff:127.0.0.1", "2001:db8::1"]) assert.equal(publicAddress(address), false, address);
  assert.equal(publicAddress("93.184.216.34"), true);
  for (const url of ["http://example.org", "https://user:password@example.org", "https://localhost", "https://example.org:8443", "https://2130706433", "https://[::ffff:127.0.0.1]"]) assert.throws(() => validateUrl(url));
  await assert.rejects(publicTarget("https://example.org", async () => [{ address: "93.184.216.34", family: 4 }, { address: "10.0.0.1", family: 4 }]), /DNS/);
});

test("research respects robots rules and extracts inert bounded text", async () => {
  const calls = [];
  const download = async (url) => { calls.push(url); return { status: 200, body: "User-agent: *\nDisallow: /private", headers: {}, url }; };
  await assert.rejects(collectPage("https://example.org/private", new AbortController().signal, download), /robots/);
  assert.equal(calls.length, 1);
  const result = extractPage({ url: "https://example.org/page", headers: { "content-type": "text/html; charset=utf-8" }, body: '<title>Page</title><script>executeMe()</script><nav>menu</nav><main><h1>Title</h1><p>Body</p><form>token</form></main>' });
  assert.equal(result.title, "Page");
  assert.match(result.text, /Body/);
  assert.doesNotMatch(result.text, /executeMe|menu|token/);
  assert.equal(extractPage({ url: result.url, headers: { "content-type": "text/plain" }, body: "x".repeat(100001) }).incomplete, true);
});

async function until(check) {
  const deadline = performance.now() + 15000;
  while (performance.now() < deadline) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("Research job did not settle.");
}

test("actual Crawlee retries a failed page, persists results and cancels a running job", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "ethical-research-"));
  let attempts = 0;
  const runtime = createResearchRuntime({ directory, collect: async (url, signal) => {
    if (url.includes("slow")) return new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(new Error("cancelled")), { once: true }));
    attempts += 1;
    if (attempts === 1) throw new Error("temporary failure");
    return { url, title: "Fixture", text: "Safe text", incomplete: false, fetchedAt: new Date().toISOString() };
  } });
  try {
    const id = await runtime.start(["https://example.org/page", "https://example.org/page"]);
    await until(async () => (await runtime.read(id)).status === "succeeded");
    assert.equal(attempts, 2);
    assert.equal((await runtime.read(id)).results.length, 1);
    const slow = await runtime.start(["https://example.org/slow"]);
    await until(async () => (await runtime.read(slow)).status === "running");
    await runtime.cancel(slow);
    await until(async () => (await runtime.read(slow)).status === "cancelled");
    const restored = createResearchRuntime({ directory });
    assert.equal((await restored.read(id)).results[0].text, "Safe text");
    await restored.remove(slow);
    assert.equal((await restored.list()).length, 1);
    await restored.stop();
  } finally { await runtime.stop(); await fs.rm(directory, { recursive: true, force: true }); }
});

function addressTransport(records, failures, calls) {
  const { EventEmitter } = require("node:events");
  return {
    lookup: async () => records,
    get: (_url, options, onResponse) => {
      const request = new EventEmitter();
      request.destroy = (error) => request.emit("error", error);
      queueMicrotask(() => {
        options.lookup("example.org", { all: true }, (_error, pinned) => {
          calls.push(pinned[0]);
          const failure = failures[calls.length - 1];
          if (failure) {
            request.emit("error", Object.assign(new Error(failure), { code: failure }));
            return;
          }
          const response = new EventEmitter();
          response.statusCode = 200;
          response.headers = { "content-type": "text/plain" };
          onResponse(response);
          response.emit("data", Buffer.from("success"));
          response.emit("end");
        });
      });
      return request;
    }
  };
}

const publicRecords = [
  { address: "2606:4700:4700::1111", family: 6 },
  { address: "93.184.216.34", family: 4 }
];

test("research falls back from unreachable IPv6 to pinned public IPv4", async () => {
  const { fetchPublic } = require("../electron/research-fetch.cjs");
  const calls = [];
  const result = await fetchPublic("https://example.org", new AbortController().signal, undefined, 0,
    addressTransport(publicRecords, ["ENETUNREACH"], calls));
  assert.equal(result.body, "success");
  assert.deepEqual(calls, publicRecords);
});

test("research rejects mixed private DNS before any connection and never retries TLS", async () => {
  const { fetchPublic } = require("../electron/research-fetch.cjs");
  const calls = [];
  await assert.rejects(fetchPublic("https://example.org", new AbortController().signal, undefined, 0,
    addressTransport([...publicRecords, { address: "10.0.0.1", family: 4 }], [], calls)), /DNS/);
  assert.equal(calls.length, 0);
  await assert.rejects(fetchPublic("https://example.org", new AbortController().signal, undefined, 0,
    addressTransport(publicRecords, ["CERT_HAS_EXPIRED"], calls)), /CERT_HAS_EXPIRED/);
  assert.equal(calls.length, 1);
});

test("research reports exhausted public addresses and abort prevents fallback", async () => {
  const { fetchPublic } = require("../electron/research-fetch.cjs");
  const calls = [];
  await assert.rejects(fetchPublic("https://example.org", new AbortController().signal, undefined, 0,
    addressTransport(publicRecords, ["ENETUNREACH", "ECONNREFUSED"], calls)), /ECONNREFUSED/);
  assert.equal(calls.length, 2);
  const controller = new AbortController();
  const transport = addressTransport(publicRecords, ["ENETUNREACH"], []);
  const get = transport.get;
  let attempts = 0;
  transport.get = (...args) => { attempts += 1; const request = get(...args); controller.abort(); return request; };
  await assert.rejects(fetchPublic("https://example.org", controller.signal, undefined, 0, transport), { name: "AbortError" });
  assert.equal(attempts, 1);
});

test("strict robots policy permits missing rules but blocks other HTTP errors", async () => {
  for (const status of [200, 404, 401, 403, 429, 500, 503]) {
    const calls = [];
    const download = async (url) => {
      calls.push(url);
      return { status: url.endsWith("robots.txt") ? status : 200, body: "", headers: { "content-type": "text/plain" }, url };
    };
    const pending = collectPage("https://example.org/page", new AbortController().signal, download);
    if ([200, 404].includes(status)) { await pending; assert.equal(calls.length, 2); }
    else { await assert.rejects(pending, /robots.txt/); assert.equal(calls.length, 1); }
  }
});

test("research does not retry another address after an HTTP response or body error", async () => {
  const { EventEmitter } = require("node:events");
  const { fetchPublic } = require("../electron/research-fetch.cjs");
  for (const bodyError of [false, true]) {
    let attempts = 0;
    const transport = {
      lookup: async () => publicRecords,
      get: (_url, _options, onResponse) => {
        attempts += 1;
        const request = new EventEmitter();
        queueMicrotask(() => {
          const response = new EventEmitter();
          response.statusCode = 503;
          response.headers = {};
          onResponse(response);
          if (bodyError) response.emit("error", Object.assign(new Error("body reset"), { code: "ECONNRESET" }));
          else response.emit("end");
        });
        return request;
      }
    };
    const pending = fetchPublic("https://example.org", new AbortController().signal, undefined, 0, transport);
    if (bodyError) await assert.rejects(pending, /body reset/);
    else assert.equal((await pending).status, 503);
    assert.equal(attempts, 1);
  }
});
