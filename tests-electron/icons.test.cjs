const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { Resvg } = require("@resvg/resvg-js");

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
