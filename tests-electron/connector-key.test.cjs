const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { createConnectorKeyProvider } = require("../electron/connector-key.cjs");

test("connector key migration preserves the existing key and removes plaintext after read-back", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "ethical-key-"));
  const key = Buffer.alloc(32, 7).toString("base64url") + "=";
  const saved = new Map();
  const store = { load: async (name) => saved.get(name), save: async (name, value) => saved.set(name, value) };
  try {
    await fs.writeFile(path.join(directory, "connector.key"), key);
    const provider = createConnectorKeyProvider({ store, directory });
    const [first, second] = await Promise.all([provider(), provider()]);
    assert.equal(first.ETHICAL_WORLD_CONNECTOR_KEY, key);
    assert.deepEqual(first, second);
    await assert.rejects(fs.stat(path.join(directory, "connector.key")), { code: "ENOENT" });
    assert.equal(saved.get("notion.master-key"), key);
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});

test("a failed encrypted write never deletes the legacy key", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "ethical-key-"));
  const key = Buffer.alloc(32, 8).toString("base64url") + "=";
  try {
    await fs.writeFile(path.join(directory, "connector.key"), key);
    const provider = createConnectorKeyProvider({ directory, store: { load: async () => null, save: async () => { throw new Error("OS storage unavailable"); } } });
    await assert.rejects(provider(), /OS storage/);
    assert.equal(await fs.readFile(path.join(directory, "connector.key"), "utf8"), key);
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});
