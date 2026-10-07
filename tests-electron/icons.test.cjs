const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { Resvg } = require("@resvg/resvg-js");
const os = require("node:os");
const { verifyDefaultIcon } = require("../scripts/test-desktop-icons.cjs");

test("all packaged icon sizes exactly match the canonical SVG artwork", () => {
  const root = path.resolve(__dirname, "..");
  const source = fs.readFileSync(path.join(root, "public", "ethical-world-mark.svg"));
  const ico = fs.readFileSync(path.join(root, "assets", "icons", "EthicalWorld.ico"));
  assert.equal(ico.readUInt16LE(2), 1);
  assert.equal(ico.readUInt16LE(4), 7);
  for (let index = 0; index < 7; index += 1) {
    const entry = 6 + index * 16;
    const size = ico[entry] || 256;
    const length = ico.readUInt32LE(entry + 8);
    const offset = ico.readUInt32LE(entry + 12);
    const expected = new Resvg(source, { fitTo: { mode: "width", value: size } }).render().asPng();
    assert.deepEqual(ico.subarray(offset, offset + length), expected);
  }
  const config = require("../forge.config.cjs");
  assert.equal(config.packagerConfig.icon, path.join(root, "assets", "icons", "EthicalWorld"));
  assert.equal(config.makers[0].config.setupIcon, path.join(root, "assets", "icons", "EthicalWorld.ico"));
});

test("binary icon verification accepts branded PE resources and rejects placeholders, missing sizes, and changed pixels", async () => {
  const { Data, NtExecutable, NtExecutableResource, Resource } = await import("resedit");
  const root = path.resolve(__dirname, "..");
  const canonical = fs.readFileSync(path.join(root, "assets", "icons", "EthicalWorld.ico"));
  const placeholder = path.join(root, "node_modules", "electron-winstaller", "vendor", "Setup.exe");
  await assert.rejects(verifyDefaultIcon(placeholder, canonical), /Wrong icon frame count|Placeholder/);
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "ethical-world-icons-"));
  const executable = path.join(directory, "EthicalWorld.exe");
  try {
    const exe = NtExecutable.from(fs.readFileSync(placeholder), { ignoreCert: true });
    const resources = NtExecutableResource.from(exe);
    const group = Resource.IconGroupEntry.fromEntries(resources.entries)[0];
    const icons = Data.IconFile.from(canonical).icons.map((item) => item.data);
    const write = () => { resources.outputResource(exe); fs.writeFileSync(executable, Buffer.from(exe.generate())); };
    Resource.IconGroupEntry.replaceIconsForResource(resources.entries, group.id, group.lang, icons);
    write();
    await verifyDefaultIcon(executable, canonical);

    const defaultGroup = Resource.IconGroupEntry.fromEntries(resources.entries)[0];
    const frame = resources.entries.find((entry) => entry.type === 3 && entry.lang === defaultGroup.lang && entry.id === defaultGroup.icons[0].iconID);
    frame.bin = frame.bin.slice(0);
    new Uint8Array(frame.bin)[frame.bin.byteLength - 1] ^= 1;
    write();
    await assert.rejects(verifyDefaultIcon(executable, canonical), /mismatched/);

    Resource.IconGroupEntry.replaceIconsForResource(resources.entries, group.id, group.lang, icons.slice(1));
    write();
    await assert.rejects(verifyDefaultIcon(executable, canonical), /Wrong icon frame count/);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
