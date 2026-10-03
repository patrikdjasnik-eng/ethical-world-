module.exports = {
  packagerConfig: {
    asar: true,
    name: "Ethical World",
    executableName: "EthicalWorld"
  },
  rebuildConfig: {},
  makers: [
    {
      name: "@electron-forge/maker-squirrel",
      config: {
        name: "ethical_world"
      }
    },
    {
      name: "@electron-forge/maker-zip",
      platforms: ["win32"]
    }
  ],
  publishers: [
    {
      name: "@electron-forge/publisher-github",
      config: {
        repository: {
          owner: "patrikdjasnik-eng",
          name: "ethical-world-"
        },
        draft: false,
        prerelease: false,
        generateReleaseNotes: true
      }
    }
  ]
};
