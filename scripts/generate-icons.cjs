const fs = require("node:fs");
const path = require("node:path");
const { Resvg } = require("@resvg/resvg-js");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "public", "ethical-world-mark.svg"));
const sizes = [16, 24, 32, 48, 64, 128, 256];
const images = sizes.map((size) => new Resvg(source, { fitTo: { mode: "width", value: size }, font: { loadSystemFonts: false } }).render().asPng());
const header = Buffer.alloc(6 + sizes.length * 16);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
sizes.forEach((size, index) => {
  const entry = 6 + index * 16;
  header[entry] = header[entry + 1] = size === 256 ? 0 : size;
  header.writeUInt16LE(1, entry + 4);
  header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(images[index].length, entry + 8);
  header.writeUInt32LE(offset, entry + 12);
  offset += images[index].length;
});
const destination = path.join(root, "assets", "icons");
fs.mkdirSync(destination, { recursive: true });
fs.writeFileSync(path.join(destination, "EthicalWorld.ico"), Buffer.concat([header, ...images]));
fs.writeFileSync(path.join(destination, "EthicalWorld.png"), images.at(-1));
