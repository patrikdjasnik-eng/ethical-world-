const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require("electron");
const path = require("node:path");
const fs = require("node:fs/promises");
const crypto = require("node:crypto");

const squirrelStartup = require("electron-squirrel-startup");
const { updateElectronApp, UpdateSourceType } = require("update-electron-app");

let mainWindow = null;
const markdownRoots = new Map();
const ignoredMarkdownDirs = new Set([".git", "node_modules", ".venv", "venv", "dist", "out", "build"]);

function registerMarkdownRoot(rootPath) {
  const normalized = path.resolve(rootPath);
  const id = crypto.createHash("sha256").update(normalized).digest("hex").slice(0, 24);
  markdownRoots.set(id, normalized);
  return { id, label: path.basename(normalized) || normalized };
}

function getMarkdownRoot(connectionId) {
  const root = markdownRoots.get(String(connectionId ?? ""));
  if (!root) throw new Error("Markdown connection is not approved in this session.");
  return root;
}

function resolveInsideRoot(root, relativePath) {
  const normalized = String(relativePath ?? "").replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalized || path.isAbsolute(normalized)) throw new Error("Invalid Markdown path.");

  const target = path.resolve(root, ...normalized.split("/"));
  const relative = path.relative(root, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Path escapes the approved Markdown root.");
  }

  return target;
}

async function collectMarkdownFiles(root) {
  const files = [];
  const queue = [{ absolute: root, relative: "" }];
  const maxFiles = 2000;
  const maxBytesPerFile = 2 * 1024 * 1024;

  while (queue.length > 0 && files.length < maxFiles) {
    const current = queue.shift();
    const entries = await fs.readdir(current.absolute, { withFileTypes: true });

    for (const entry of entries) {
      if (files.length >= maxFiles) break;
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory() && ignoredMarkdownDirs.has(entry.name)) continue;

      const relativePath = current.relative ? current.relative + "/" + entry.name : entry.name;
      const absolutePath = path.join(current.absolute, entry.name);

      if (entry.isDirectory()) {
        queue.push({ absolute: absolutePath, relative: relativePath });
        continue;
      }

      if (!entry.isFile() || !/\.(md|mdx)$/i.test(entry.name)) continue;

      const stat = await fs.stat(absolutePath);
      if (stat.size > maxBytesPerFile) continue;

      files.push({
        relativePath: relativePath.replace(/\\/g, "/"),
        content: await fs.readFile(absolutePath, "utf8")
      });
    }
  }

  return { files, truncated: files.length >= maxFiles };
}

if (!squirrelStartup) {
  if (process.platform === "win32") {
    app.setAppUserModelId("com.squirrel.ethical_world.EthicalWorld");
  }

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

  ipcMain.handle("desktop:select-markdown-folder", async () => {
    const result = await dialog.showOpenDialog(mainWindow ?? undefined, {
      title: "Vyber Markdown / VS Code workspace",
      properties: ["openDirectory", "createDirectory"]
    });

    if (result.canceled || result.filePaths.length === 0) return null;
    return registerMarkdownRoot(result.filePaths[0]);
  });

  ipcMain.handle("desktop:read-markdown-files", async (_event, connectionId) => {
    return collectMarkdownFiles(getMarkdownRoot(connectionId));
  });

  ipcMain.handle("desktop:write-markdown-files", async (_event, connectionId, rawFiles) => {
    const root = getMarkdownRoot(connectionId);
    const files = Array.isArray(rawFiles) ? rawFiles.slice(0, 2000) : [];
    let written = 0;

    for (const file of files) {
      const relativePath = String(file?.relativePath ?? "");
      if (!/\.(md|mdx)$/i.test(relativePath)) continue;

      const target = resolveInsideRoot(root, relativePath);
      const content = String(file?.content ?? "");
      if (Buffer.byteLength(content, "utf8") > 2 * 1024 * 1024) continue;

      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, content, "utf8");
      written += 1;
    }

    return { written };
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
