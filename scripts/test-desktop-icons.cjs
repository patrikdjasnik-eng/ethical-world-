const fs = require("node:fs");
const path = require("node:path");

function readIconFrames(ico) {
  if (ico.length < 6 || ico.readUInt16LE(0) !== 0 || ico.readUInt16LE(2) !== 1) throw new Error("Invalid canonical ICO.");
  const count = ico.readUInt16LE(4);
  if (!count || ico.length < 6 + count * 16) throw new Error("Missing ICO frames.");
  const frames = new Map();
  for (let index = 0; index < count; index += 1) {
    const entry = 6 + index * 16;
    const key = `${ico[entry] || 256}x${ico[entry + 1] || 256}`;
    const length = ico.readUInt32LE(entry + 8);
    const offset = ico.readUInt32LE(entry + 12);
    if (!length || offset < 6 + count * 16 || offset + length > ico.length || frames.has(key)) throw new Error("Invalid ICO frame.");
    frames.set(key, ico.subarray(offset, offset + length));
  }
  return frames;
}

async function verifyDefaultIcon(executable, canonicalIco) {
  const { NtExecutable, NtExecutableResource, Resource } = await import("resedit");
  const expected = readIconFrames(canonicalIco);
  const exe = NtExecutable.from(fs.readFileSync(executable), { ignoreCert: true });
  const resources = NtExecutableResource.from(exe);
  const groups = Resource.IconGroupEntry.fromEntries(resources.entries);
  if (!groups.length) throw new Error(`No icon resource in ${executable}`);
  // Other groups can contain installer dialog graphics. Inspect every language
  // of the first group, which is the file's default application icon.
  for (const group of groups.filter((candidate) => candidate.id === groups[0].id)) {
    if (group.icons.length !== expected.size) throw new Error(`Wrong icon frame count in ${executable}: ${group.icons.length}, expected ${expected.size}`);
    const seen = new Set();
    for (const frame of group.icons) {
      const key = `${frame.width || 256}x${frame.height || 256}`;
      const image = resources.entries.find((entry) => entry.type === 3 && entry.id === frame.iconID && entry.lang === group.lang);
      const expectedImage = expected.get(key);
      if (seen.has(key) || !image || !expectedImage || !Buffer.from(image.bin).equals(expectedImage)) {
        throw new Error(`Placeholder or mismatched ${key} icon resource in ${executable} (group ${group.id}, language ${group.lang})`);
      }
      seen.add(key);
    }
  }
}

function findExecutables(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) return ["backend-build", "backend-spec"].includes(entry.name) ? [] : findExecutables(filename);
    return entry.isFile() && ["EthicalWorld.exe", "EthicalWorldSetup.exe", "EthicalWorldBackend.exe"].includes(entry.name) ? [filename] : [];
  });
}

async function main() {
  const root = path.resolve(__dirname, "..");
  const expected = fs.readFileSync(path.join(root, "assets", "icons", "EthicalWorld.ico"));
  const executables = findExecutables(path.resolve(root, process.argv[2] || "out"));
  for (const name of ["EthicalWorld.exe", "EthicalWorldSetup.exe", "EthicalWorldBackend.exe"]) {
    if (!executables.some((filename) => path.basename(filename) === name)) throw new Error(`Missing packaged ${name}`);
  }
  for (const executable of executables) {
    await verifyDefaultIcon(executable, expected);
    console.log(`[PASS] All seven branded icon resources: ${executable}`);
  }
}

module.exports = { readIconFrames, verifyDefaultIcon };
if (require.main === module) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
