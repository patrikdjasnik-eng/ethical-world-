const fs = require("node:fs");
const path = require("node:path");
const packageVersion = process.env.ETHICAL_WORLD_PACKAGE_VERSION;
if (packageVersion && !/^\d+\.\d+\.\d+$/.test(packageVersion)) throw new Error("Invalid desktop package version.");

const extraResource = ["server"];
const bundledBackend = path.join(__dirname, "resources", "backend");
if (fs.existsSync(bundledBackend)) extraResource.push(bundledBackend);

module.exports = {
  outDir: process.env.ETHICAL_WORLD_BUILD_DIR || "out",
  packagerConfig: {
    ...(packageVersion ? { appVersion: packageVersion } : {}),
    asar: true,
    ignore: [/^\/out(?:\/|$)/, /^\/\.venv(?:\/|$)/, /^\/resources(?:\/|$)/, /^\/\.git(?:\/|$)/, /^\/\.env(?:\.|$)/],
    name: "Ethical World",
    executableName: "EthicalWorld",
    extraResource
  },
  rebuildConfig: {},
  hooks: {
    readPackageJson: async (_config, packageJson) => packageVersion ? { ...packageJson, version: packageVersion } : packageJson
  },
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
