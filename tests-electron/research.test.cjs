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
  for (let count = 0; count < 150; count += 1) {
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
