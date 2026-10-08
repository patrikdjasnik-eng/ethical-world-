const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");

function validateKey(key) {
  if (typeof key !== "string" || !/^[a-z0-9_-]{43}=$/i.test(key) || Buffer.from(key, "base64url").length !== 32) throw new Error("Notion connector key is invalid; existing data was not replaced.");
  return key;
}

function createConnectorKeyProvider({ store, directory }) {
  let flight;
  return () => {
    if (!flight) flight = (async () => {
      const legacy = path.join(directory, "connector.key");
      let stored = await store.load("notion.master-key");
      let old;
      try { old = validateKey((await fs.readFile(legacy, "utf8")).trim()); }
      catch (error) { if (error.code !== "ENOENT") throw error; }
      if (stored) stored = validateKey(stored);
      if (stored && old && stored !== old) throw new Error("Notion key migration conflict; both keys were preserved.");
      const key = stored ?? old ?? crypto.randomBytes(32).toString("base64url") + "=";
      if (!stored) await store.save("notion.master-key", key);
      // Delete plaintext only after a successful encrypted write and read-back.
      if (await store.load("notion.master-key") !== key) throw new Error("Notion OS key storage verification failed.");
      if (old) await fs.rm(legacy);
      return { ETHICAL_WORLD_CONNECTOR_KEY: key };
    })().catch((error) => { flight = undefined; throw error; });
    return flight;
  };
}
module.exports = { createConnectorKeyProvider };
