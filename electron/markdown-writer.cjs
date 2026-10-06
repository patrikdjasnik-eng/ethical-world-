const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { isInside } = require("./security.cjs");

const contentHash = (content) => crypto.createHash("sha256").update(content).digest("hex");

async function safeTarget(root, relativePath, createParents = false) {
  if (typeof relativePath !== "string" || !/\.(md|mdx)$/i.test(relativePath)) throw new Error("Invalid Markdown path.");
  const parts = relativePath.replace(/\\/g, "/").split("/");
  if (parts.some((part) => !part || part === "." || part === ".." || /[:\x00-\x1f]/.test(part) || /[ .]$/.test(part) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part))) throw new Error("Invalid Markdown path segment.");
  const canonicalRoot = await fs.realpath(root);
  if (path.resolve(root) !== path.resolve(canonicalRoot)) throw new Error("Approved root identity changed.");
  let target = root;
  for (let index = 0; index < parts.length; index += 1) {
    target = path.join(target, parts[index]);
    try {
      const stat = await fs.lstat(target);
      if (stat.isSymbolicLink()) throw new Error("Symlink/junction není povolený pro Markdown zápis.");
      if (index < parts.length - 1 && !stat.isDirectory()) throw new Error("Markdown parent není složka.");
      if (index === parts.length - 1 && !stat.isFile()) throw new Error("Markdown target není soubor.");
      if (!isInside(root, await fs.realpath(target))) throw new Error("Path escapes approved root.");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      if (createParents && index < parts.length - 1) await fs.mkdir(target);
    }
  }
  return target;
}

async function currentHash(target) {
  try {
    const stat = await fs.lstat(target);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 2 * 1024 * 1024) throw new Error("Invalid existing Markdown target.");
    return contentHash(await fs.readFile(target));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function writeMarkdownBatch(root, files, baselines) {
  if (!Array.isArray(files) || files.length > 2000) throw new Error("Markdown export má příliš mnoho souborů.");
  const plan = [];
  const seen = new Set();
  for (const file of files) {
    if (typeof file?.content !== "string" || Buffer.byteLength(file.content) > 2 * 1024 * 1024) throw new Error("Markdown content je příliš velký.");
    const target = await safeTarget(root, file.relativePath);
    const key = process.platform === "win32" ? target.toLowerCase() : target;
    if (seen.has(key)) throw new Error("Duplicate Markdown target.");
    seen.add(key);
    const actual = await currentHash(target);
    const expected = baselines.get(file.relativePath) ?? null;
    if (actual !== expected && actual !== contentHash(file.content)) throw new Error("Konflikt: „" + file.relativePath + "“ se od importu změnil nebo nebyl importovaný.");
    plan.push({ ...file, target, actual });
  }
  for (const file of plan) {
    await safeTarget(root, file.relativePath, true);
    const temporary = file.target + "." + crypto.randomUUID() + ".tmp";
    try {
      await fs.writeFile(temporary, file.content, { flag: "wx", mode: 0o600 });
      await safeTarget(root, file.relativePath);
      if (await currentHash(file.target) !== file.actual) throw new Error("Soubor se změnil během exportu.");
      if (file.actual !== null) {
        const backup = file.target + "." + crypto.randomUUID() + ".bak";
        await fs.copyFile(file.target, backup, require("node:fs").constants.COPYFILE_EXCL);
      }
      await fs.rename(temporary, file.target);
      baselines.set(file.relativePath, contentHash(file.content));
    } finally {
      await fs.rm(temporary, { force: true });
    }
  }
  return { written: plan.length };
}

module.exports = { safeTarget, contentHash, writeMarkdownBatch };
