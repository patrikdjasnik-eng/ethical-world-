const fs = require("node:fs");
const path = require("node:path");
const { Resvg } = require("@resvg/resvg-js");

const root = path.resolve(__dirname, "..");
const sourcePath = path.join(root, "public", "ethical-world-mark.svg");
if (!fs.existsSync(sourcePath)) throw new Error("Chybí zdrojová ikona: " + sourcePath);
const source = fs.readFileSync(sourcePath);
const mode = process.argv[2] ?? "all";

function renderPng(size) {
  return new Resvg(source, {
    fitTo: { mode: "width", value: size },
    font: { loadSystemFonts: false }
  }).render().asPng();
}

function writePng(filePath, size) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, renderPng(size));
}

if (mode !== "--android-only") {
  writePng(path.join(root, "public", "ethical-world-icon-192.png"), 192);
  writePng(path.join(root, "public", "ethical-world-icon-512.png"), 512);
}

if (mode !== "--web-only") {
  const androidRes = path.join(root, "android", "app", "src", "main", "res");
  if (!fs.existsSync(androidRes)) {
    throw new Error("Android projekt ještě neexistuje. Nejdřív spusť npx cap add android.");
  }

  const legacySizes = {
    "mipmap-mdpi": 48,
    "mipmap-hdpi": 72,
    "mipmap-xhdpi": 96,
    "mipmap-xxhdpi": 144,
    "mipmap-xxxhdpi": 192
  };
  for (const [directory, size] of Object.entries(legacySizes)) {
    const target = path.join(androidRes, directory);
    writePng(path.join(target, "ic_launcher.png"), size);
    writePng(path.join(target, "ic_launcher_round.png"), size);
  }

  const adaptiveSizes = {
    "mipmap-mdpi": 108,
    "mipmap-hdpi": 162,
    "mipmap-xhdpi": 216,
    "mipmap-xxhdpi": 324,
    "mipmap-xxxhdpi": 432
  };
  for (const [directory, size] of Object.entries(adaptiveSizes)) {
    writePng(path.join(androidRes, directory, "ic_launcher_foreground.png"), size);
  }

  const adaptiveXml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background" />
    <foreground android:drawable="@mipmap/ic_launcher_foreground" />
</adaptive-icon>
`;
  for (const name of ["ic_launcher.xml", "ic_launcher_round.xml"]) {
    const target = path.join(androidRes, "mipmap-anydpi-v26", name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, adaptiveXml, "utf8");
  }

  const colors = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#07110D</color>
</resources>
`;
  const colorsPath = path.join(androidRes, "values", "ic_launcher_background.xml");
  fs.mkdirSync(path.dirname(colorsPath), { recursive: true });
  fs.writeFileSync(colorsPath, colors, "utf8");
}

console.log("Ethical World ikony vygenerovány z public/ethical-world-mark.svg (" + mode + ").");
