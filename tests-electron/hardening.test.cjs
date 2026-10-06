const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const http = require("node:http");
const { createSecureStore, createSigner } = require("../electron/secure-store.cjs");
const { safeTarget, contentHash, writeMarkdownBatch } = require("../electron/markdown-writer.cjs");
const { verifyBackend, gatewayRequest } = require("../electron/backend-runtime.cjs");

async function fixture(run) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "ethical-test-"));
  try { await run(root); } finally { await fs.rm(root, { recursive: true, force: true }); }
}
const encryption = {
  isEncryptionAvailable: () => true,
  encryptString: (value) => Buffer.from(value),
  decryptString: (value) => value.toString()
};

test("concurrent secret mutations retain every entry and corruption is never overwritten", async () => fixture(async (root) => {
  const target = path.join(root, "secrets.json");
  const store = createSecureStore(target, encryption);
  await Promise.all(Array.from({ length: 20 }, (_, index) => store.save("secret" + index, String(index))));
  for (let index = 0; index < 20; index += 1) assert.equal(await store.load("secret" + index), String(index));
  await fs.writeFile(target, "broken");
  await assert.rejects(store.save("other", "value"));
  assert.equal(await fs.readFile(target, "utf8"), "broken");
}));

test("signer is stable under concurrent first use and rejects attacker keys and rollback", async () => fixture(async (root) => {
  const store = createSecureStore(path.join(root, "secrets.json"), encryption);
  const signer = createSigner(store);
  const payloads = Array.from({ length: 10 }, (_, index) => JSON.stringify({ noteId: "note" + index, id: "root", snapshotHash: "hash", parentCommitHash: null }));
  const signed = await Promise.all(payloads.map((payload) => signer.sign(payload)));
  await Promise.all(signed.map((item, index) => signer.confirm(payloads[index], item.signature, item.publicKey)));
  assert.equal(new Set(signed.map((item) => item.publicKey)).size, 1);
  assert.equal(await signer.verify(payloads[0], signed[0].signature, signed[0].publicKey), true);
  const attacker = crypto.generateKeyPairSync("ed25519");
  const attackKey = attacker.publicKey.export({ type: "spki", format: "pem" }).toString();
  const signature = crypto.sign(null, Buffer.from(payloads[0]), attacker.privateKey).toString("base64");
  assert.equal(await signer.verify(payloads[0], signature, attackKey), false);
  await assert.rejects(signer.sign(payloads[0]), /hlavě/);
  const hash = crypto.createHash("sha256").update(payloads[0]).digest("hex");
  assert.equal(await signer.verifyHead("note0", hash), true);
  assert.equal(await signer.verifyHead("note0", "old"), false);
}));

test("Markdown writer refuses links, traversal and external targets", async () => fixture(async (root) => {
  const vault = path.join(root, "vault");
  const outside = path.join(root, "outside");
  await fs.mkdir(vault); await fs.mkdir(outside);
  await fs.symlink(outside, path.join(vault, "linked"), process.platform === "win32" ? "junction" : "dir");
  await assert.rejects(safeTarget(vault, "linked/test.md"), /Symlink/);
  await assert.rejects(safeTarget(vault, "../test.md"));
  await assert.rejects(safeTarget(vault, "CON.md"));
  assert.deepEqual(await fs.readdir(outside), []);
}));

test("Markdown export preflights conflicts and backs up overwritten content", async () => fixture(async (root) => {
  const original = path.join(root, "one.md");
  await fs.writeFile(original, "old");
  const baseline = new Map([["one.md", contentHash("old")]]);
  await fs.writeFile(path.join(root, "two.md"), "external");
  await assert.rejects(writeMarkdownBatch(root, [{ relativePath: "one.md", content: "new" }, { relativePath: "two.md", content: "overwrite" }], baseline), /Konflikt/);
  assert.equal(await fs.readFile(original, "utf8"), "old");
  assert.equal((await writeMarkdownBatch(root, [{ relativePath: "one.md", content: "new" }], baseline)).written, 1);
  assert.equal(await fs.readFile(original, "utf8"), "new");
  const backup = (await fs.readdir(root)).find((file) => file.endsWith(".bak"));
  assert.equal(await fs.readFile(path.join(root, backup), "utf8"), "old");
}));

test("fake healthy backend never receives a capability or a password", async () => {
  const requests = [];
  const server = http.createServer((request, response) => {
    requests.push({ url: request.url, capability: request.headers["x-ethical-capability"] });
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ status: "ok", proof: "fake" }));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = "http://127.0.0.1:" + server.address().port;
  try {
    assert.equal(await verifyBackend(base, "secret"), false);
    await assert.rejects(gatewayRequest(base, "secret", { path: "/api/auth/login", method: "POST", body: '{"password":"demo"}' }), /identity/);
    assert.ok(requests.every((request) => request.url.startsWith("/health?challenge=") && !request.capability));
    await assert.rejects(gatewayRequest(base, "secret", { path: "/api/auth/../anything", method: "GET" }), /Blocked/);
  } finally { await new Promise((resolve) => server.close(resolve)); }
});
