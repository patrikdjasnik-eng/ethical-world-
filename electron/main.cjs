const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require("electron");
const path = require("node:path");

const squirrelStartup = require("electron-squirrel-startup");
const { updateElectronApp, UpdateSourceType } = require("update-electron-app");

let mainWindow = null;

if (!squirrelStartup) {
  if (app.isPackaged) {
    updateElectronApp({
      updateSource: {
        type: UpdateSourceType.ElectronPublicUpdateService,
        repo: "patrikdjasnik-eng/ethical-world-"
      },
      updateInterval: "10 minutes",
      notifyUser: true
    });
  }

  function createWindow() {
    mainWindow = new BrowserWindow({
      width: 1500,
      height: 930,
      minWidth: 980,
      minHeight: 680,
      backgroundColor: "#09090b",
      autoHideMenuBar: true,
      show: false,
      webPreferences: {
        preload: path.join(__dirname, "preload.cjs"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    });

    mainWindow.once("ready-to-show", () => {
      mainWindow?.show();
    });

    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      void shell.openExternal(url);
      return { action: "deny" };
    });

    if (app.isPackaged) {
      void mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
    } else {
      void mainWindow.loadURL("http://127.0.0.1:5173");
    }
  }

  ipcMain.handle("desktop:context-menu", async (event, rawItems) => {
    const items = Array.isArray(rawItems) ? rawItems : [];

    return new Promise((resolve) => {
      let settled = false;

      const finish = (value) => {
        if (settled) {
          return;
        }

        settled = true;
        resolve(value);
      };

      const template = items.map((item) => {
        if (item?.type === "separator") {
          return { type: "separator" };
        }

        return {
          label: String(item?.label ?? ""),
          enabled: item?.enabled !== false,
          click: () => finish(String(item?.id ?? ""))
        };
      });

      const menu = Menu.buildFromTemplate(template);
      const owner = BrowserWindow.fromWebContents(event.sender) ?? mainWindow ?? undefined;

      menu.popup({
        window: owner,
        callback: () => finish(null)
      });
    });
  });

  ipcMain.handle("desktop:select-vault-folder", async () => {
    const result = await dialog.showOpenDialog(mainWindow ?? undefined, {
      title: "Vyber Ethical World vault",
      properties: ["openDirectory", "createDirectory"]
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  });

  app.whenReady().then(() => {
    createWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });
}
