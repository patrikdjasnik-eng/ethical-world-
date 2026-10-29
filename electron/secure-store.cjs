const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");

function createSecureStore(filePath, encryption) {
  let tail = Promise.resolve();
  const serial = (operation) => {
    const result = tail.catch(() => undefined).then(operation);
    tail = result;
    return result;
  };
  const read = async () => {
    try {
      const data = JSON.parse(await fs.readFile(filePath, "utf8"));
      if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Invalid secret store.");
      return data;
    } catch (error) {
      if (error.code === "ENOENT") return {};
      throw new Error("Secret store nelze načíst; původní soubor nebyl přepsán.", { cause: error });
    }
  };
  const mutate = (name, value) => serial(async () => {
    if (!encryption.isEncryptionAvailable()) throw new Error("OS secure storage není dostupné.");
    const data = await read();
    if (value === null) delete data[name];
    else data[name] = encryption.encryptString(value).toString("base64");
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const temporary = filePath + "." + crypto.randomUUID() + ".tmp";
    try {
      await fs.writeFile(temporary, JSON.stringify(data), { flag: "wx", mode: 0o600 });
      await fs.rename(temporary, filePath);
    } finally {
      await fs.rm(temporary, { force: true });
    }
  });
  return {
    save: (name, value) => mutate(name, String(value)),
    delete: (name) => mutate(name, null),
    load: (name) => serial(async () => {
      const data = await read();
      if (!data[name]) return null;
      if (!encryption.isEncryptionAvailable()) throw new Error("OS secure storage není dostupné.");
      return encryption.decryptString(Buffer.from(data[name], "base64"));
    })
  };
}

function createSigner(store) {
  let identityPromise = null;
  let signingTail = Promise.resolve();
  const identity = () => {
    if (!identityPromise) identityPromise = (async () => {
      const saved = await store.load("carrot.identity.v2");
      if (saved) return JSON.parse(saved);
      let privateKey = await store.load("carrot.ed25519.private");
      const oldPublicKey = await store.load("carrot.ed25519.public");
      if (!privateKey) privateKey = crypto.generateKeyPairSync("ed25519").privateKey.export({ type: "pkcs8", format: "pem" }).toString();
      const publicKey = crypto.createPublicKey(privateKey).export({ type: "spki", format: "pem" }).toString();
      const result = {
        privateKey, publicKey,
        keyId: crypto.createHash("sha256").update(publicKey).digest("hex").slice(0, 16),
        trustedPublicKeys: [...new Set([publicKey, ...(oldPublicKey ? [oldPublicKey] : [])])]
      };
      await store.save("carrot.identity.v2", JSON.stringify(result));
      return result;
    })().catch((error) => { identityPromise = null; throw error; });
    return identityPromise;
  };
  return {
    sign: (payload) => {
      const task = signingTail.catch(() => undefined).then(async () => {
        if (typeof payload !== "string" || Buffer.byteLength(payload) > 128 * 1024) throw new Error("Invalid signing payload.");
        const parsed = JSON.parse(payload);
        if (!parsed.noteId || !parsed.id || typeof parsed.snapshotHash !== "string") throw new Error("Invalid Carrot commit.");
        const signer = await identity();
        const checkpointName = "carrot.head." + crypto.createHash("sha256").update(parsed.noteId).digest("hex");
        const checkpoint = await store.load(checkpointName);
        if (checkpoint && parsed.parentCommitHash !== checkpoint) throw new Error("Carrot historie neodpovídá důvěryhodné hlavě. Obnov původní historii.");
        const signature = crypto.sign(null, Buffer.from(payload), signer.privateKey).toString("base64");
        return { signature, publicKey: signer.publicKey, keyId: signer.keyId };
      });
      signingTail = task;
      return task;
    },
    verify: async (payload, signature, publicKey) => {
      try {
        if (typeof payload !== "string" || Buffer.byteLength(payload) > 128 * 1024) return false;
        const signer = await identity();
        if (!signer.trustedPublicKeys.includes(publicKey)) return false;
        return crypto.verify(null, Buffer.from(payload), publicKey, Buffer.from(signature, "base64"));
      } catch { return false; }
    },
    confirm: (payload, signature, publicKey) => {
      const task = signingTail.catch(() => undefined).then(async () => {
        if (typeof payload !== "string" || Buffer.byteLength(payload) > 128 * 1024) throw new Error("Invalid Carrot checkpoint.");
        const signer = await identity();
        if (!signer.trustedPublicKeys.includes(publicKey) || !crypto.verify(null, Buffer.from(payload), publicKey, Buffer.from(signature, "base64"))) throw new Error("Untrusted Carrot checkpoint.");
        const parsed = JSON.parse(payload);
        const name = "carrot.head." + crypto.createHash("sha256").update(String(parsed.noteId)).digest("hex");
        const hash = crypto.createHash("sha256").update(payload).digest("hex");
        const previous = await store.load(name);
        if (previous === hash) return true;
        if (previous && parsed.parentCommitHash !== previous) throw new Error("Carrot checkpoint diverges from trusted head.");
        await store.save(name, hash);
        return true;
      });
      signingTail = task;
      return task;
    },
    verifyHead: async (noteId, commitHash) => {
      const saved = await store.load("carrot.head." + crypto.createHash("sha256").update(noteId).digest("hex"));
      return saved ? saved === commitHash : null;
    }
  };
}

module.exports = { createSecureStore, createSigner };
