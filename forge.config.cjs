const fs = require("node:fs");
const path = require("node:path");

const extraResource = ["server"];
const bundledBackend = path.join(__dirname, "resources", "backend");
if (fs.existsSync(bundledBackend)) extraResource.push(bundledBackend);

module.exports = {
  outDir: process.env.ETHICAL_WORLD_BUILD_DIR || "out",
  packagerConfig: {
    asar: true,
    ignore: [/^\/out(?:\/|$)/, /^\/\.venv(?:\/|$)/, /^\/resources(?:\/|$)/, /^\/\.git(?:\/|$)/, /^\/\.env(?:\.|$)/],
    name: "Ethical World",
    executableName: "EthicalWorld",
    extraResource
  },
  rebuildConfig: {},
  makers: [
    {
      name: "@electron-forge/maker-squirrel",
      config: {
        name: "ethical_world",
        title: "Ethical World",
        exe: "EthicalWorld.exe",
        setupExe: "EthicalWorldSetup.exe",
        noMsi: true
      }
    },
    { name: "@electron-forge/maker-zip", platforms: ["win32"] }
  ],
  publishers: [
    {
      name: "@electron-forge/publisher-github",
      config: {
        repository: { owner: "patrikdjasnik-eng", name: "ethical-world-" },
        draft: false,
        prerelease: false,
        generateReleaseNotes: true
      }
    }
  ]
};
