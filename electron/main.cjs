const { app, BrowserWindow, Menu, dialog, ipcMain, safeStorage, shell } = require("electron");
const path = require("node:path");
const fs = require("node:fs/promises");
const crypto = require("node:crypto");

const squirrelStartup = require("electron-squirrel-startup");
const { updateElectronApp, UpdateSourceType } = require("update-electron-app");

let mainWindow = null;
const markdownRoots = new Map();
const ignoredMarkdownDirs = new Set([".git", "node_modules", ".venv", "venv", "dist", "out", "build"]);
const githubDeviceSessions = new Map();
const githubClientId = String(process.env.ETHICAL_GITHUB_CLIENT_ID ?? "").trim();
const githubApiVersion = "2026-03-10";

function secretFilePath() {
  return path.join(app.getPath("userData"), "secrets.json");
}

async function readSecretFile() {
  try {
    const raw = await fs.readFile(secretFilePath(), "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function saveSecret(name, value) {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error("OS secure storage is not available.");
  }

  const data = await readSecretFile();
  data[name] = safeStorage.encryptString(String(value)).toString("base64");
  await fs.writeFile(secretFilePath(), JSON.stringify(data), "utf8");
}

async function loadSecret(name) {
  const data = await readSecretFile();
  const encoded = data[name];
  if (!encoded || !safeStorage.isEncryptionAvailable()) return null;

  try {
    return safeStorage.decryptString(Buffer.from(encoded, "base64"));
  } catch {
    return null;
  }
}

async function deleteSecret(name) {
  const data = await readSecretFile();
  if (!(name in data)) return;
  delete data[name];
  await fs.writeFile(secretFilePath(), JSON.stringify(data), "utf8");
}

async function githubRequest(apiPath, options = {}) {
  const token = await loadSecret("github.oauth");
  if (!token) throw new Error("GitHub není připojený.");

  const response = await fetch("https://api.github.com" + apiPath, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: "Bearer " + token,
      "X-GitHub-Api-Version": githubApiVersion,
      "User-Agent": "Ethical-World-Desktop",
      ...(options.headers ?? {})
    }
  });

  if (!response.ok) {
    if (response.status === 401) {
      await deleteSecret("github.oauth");
    }

    const payload = await response.json().catch(() => null);
    throw new Error(payload?.message ?? ("GitHub API chyba (" + response.status + ")"));
  }

  if (response.status === 204) return null;
  return response.json();
}

function validateRepoFullName(value) {
  const normalized = String(value ?? "").trim();
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(normalized)) {
    throw new Error("Neplatný GitHub repository název.");
  }
  return normalized;
}

function githubConnectionId(repoFullName, branch) {
  return "github:" + repoFullName + ":" + branch;
}

async function githubRepoInfo(repoFullName) {
  const safeRepo = validateRepoFullName(repoFullName);
  return githubRequest("/repos/" + safeRepo);
}

async function githubMarkdownFiles(repoFullName, branchName) {
  const safeRepo = validateRepoFullName(repoFullName);
  const repo = await githubRepoInfo(safeRepo);
  const branch = String(branchName || repo.default_branch || "main");
  const tree = await githubRequest(
    "/repos/" + safeRepo + "/git/trees/" + encodeURIComponent(branch) + "?recursive=1"
  );

  const entries = Array.isArray(tree?.tree) ? tree.tree : [];
  const blobs = entries
    .filter((entry) =>
      entry?.type === "blob" &&
      typeof entry.path === "string" &&
      /\.(md|mdx)$/i.test(entry.path) &&
      Number(entry.size ?? 0) <= 2 * 1024 * 1024
    )
    .slice(0, 500);

  const files = [];
  for (const entry of blobs) {
    const blob = await githubRequest("/repos/" + safeRepo + "/git/blobs/" + entry.sha);
    if (blob?.encoding !== "base64" || typeof blob?.content !== "string") continue;

    files.push({
      relativePath: entry.path,
      content: Buffer.from(blob.content.replace(/\n/g, ""), "base64").toString("utf8")
    });
  }

  return {
    files,
    repoFullName: safeRepo,
    branch,
    connectionId: githubConnectionId(safeRepo, branch),
    truncated: blobs.length >= 500 || Boolean(tree?.truncated)
  };
}

async function githubWriteMarkdown(repoFullName, branchName, rawFiles) {
  const safeRepo = validateRepoFullName(repoFullName);
  const repo = await githubRepoInfo(safeRepo);
  const branch = String(branchName || repo.default_branch || "main");
  const refPath = branch.split("/").map(encodeURIComponent).join("/");
  const ref = await githubRequest("/repos/" + safeRepo + "/git/ref/heads/" + refPath);
  const parentCommitSha = ref?.object?.sha;
  if (!parentCommitSha) throw new Error("Nepodařilo se načíst GitHub branch.");

  const parentCommit = await githubRequest("/repos/" + safeRepo + "/git/commits/" + parentCommitSha);
  const baseTreeSha = parentCommit?.tree?.sha;
  if (!baseTreeSha) throw new Error("Nepodařilo se načíst GitHub tree.");

  const files = Array.isArray(rawFiles) ? rawFiles.slice(0, 500) : [];
  const treeEntries = [];

  for (const file of files) {
    const relativePath = String(file?.relativePath ?? "").replace(/\\/g, "/").replace(/^\/+/, "");
    if (!/\.(md|mdx)$/i.test(relativePath)) continue;
    if (relativePath.split("/").some((part) => !part || part === "." || part === "..")) continue;

    const content = String(file?.content ?? "");
    if (Buffer.byteLength(content, "utf8") > 2 * 1024 * 1024) continue;

    const blob = await githubRequest("/repos/" + safeRepo + "/git/blobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, encoding: "utf-8" })
    });

    treeEntries.push({
      path: relativePath,
      mode: "100644",
      type: "blob",
      sha: blob.sha
    });
  }

  if (treeEntries.length === 0) {
    return { written: 0, branch, commitSha: parentCommitSha };
  }

  const nextTree = await githubRequest("/repos/" + safeRepo + "/git/trees", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ base_tree: baseTreeSha, tree: treeEntries })
  });

  const commit = await githubRequest("/repos/" + safeRepo + "/git/commits", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: "📝 docs: sync Markdown from Ethical World",
      tree: nextTree.sha,
      parents: [parentCommitSha]
    })
  });

  await githubRequest("/repos/" + safeRepo + "/git/refs/heads/" + refPath, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sha: commit.sha, force: false })
  });

  return { written: treeEntries.length, branch, commitSha: commit.sha };
}

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

  ipcMain.handle("desktop:github-status", async () => {
    if (!githubClientId) {
      return { configured: false, connected: false, login: null };
    }

    const token = await loadSecret("github.oauth");
    if (!token) return { configured: true, connected: false, login: null };

    try {
      const user = await githubRequest("/user");
      return { configured: true, connected: true, login: user.login ?? null };
    } catch {
      return { configured: true, connected: false, login: null };
    }
  });

  ipcMain.handle("desktop:github-start-login", async () => {
    if (!githubClientId) {
      return { configured: false };
    }

    const response = await fetch("https://github.com/login/device/code", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        client_id: githubClientId,
        scope: "repo read:user"
      })
    });

    if (!response.ok) throw new Error("GitHub Device OAuth se nepodařilo spustit.");
    const payload = await response.json();
    const sessionId = crypto.randomUUID();
    const interval = Math.max(Number(payload.interval ?? 5), 5);
    const expiresAt = Date.now() + Number(payload.expires_in ?? 900) * 1000;

    githubDeviceSessions.set(sessionId, {
      deviceCode: payload.device_code,
      interval,
      expiresAt
    });

    if (payload.verification_uri) {
      void shell.openExternal(payload.verification_uri);
    }

    return {
      configured: true,
      sessionId,
      userCode: payload.user_code,
      verificationUri: payload.verification_uri,
      intervalSeconds: interval,
      expiresAt
    };
  });

  ipcMain.handle("desktop:github-poll-login", async (_event, sessionId) => {
    const session = githubDeviceSessions.get(String(sessionId ?? ""));
    if (!session) return { status: "expired" };
    if (Date.now() >= session.expiresAt) {
      githubDeviceSessions.delete(String(sessionId));
      return { status: "expired" };
    }

    const response = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        client_id: githubClientId,
        device_code: session.deviceCode,
        grant_type: "urn:ietf:params:oauth:grant-type:device_code"
      })
    });

    const payload = await response.json();

    if (payload.error === "authorization_pending") return { status: "pending" };
    if (payload.error === "slow_down") {
      session.interval += 5;
      return { status: "pending", intervalSeconds: session.interval };
    }
    if (payload.error) {
      githubDeviceSessions.delete(String(sessionId));
      return { status: "error", error: payload.error_description ?? payload.error };
    }

    if (!payload.access_token) return { status: "pending" };

    await saveSecret("github.oauth", payload.access_token);
    githubDeviceSessions.delete(String(sessionId));

    const user = await githubRequest("/user");
    return { status: "connected", login: user.login ?? null };
  });

  ipcMain.handle("desktop:github-disconnect", async () => {
    await deleteSecret("github.oauth");
    return { connected: false };
  });

  ipcMain.handle("desktop:github-list-repos", async () => {
    const repos = await githubRequest(
      "/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member"
    );

    return (Array.isArray(repos) ? repos : []).map((repo) => ({
      fullName: repo.full_name,
      private: Boolean(repo.private),
      defaultBranch: repo.default_branch || "main",
      canPush: Boolean(repo.permissions?.push)
    }));
  });

  ipcMain.handle("desktop:github-read-markdown", async (_event, repoFullName, branch) => {
    return githubMarkdownFiles(repoFullName, branch);
  });

  ipcMain.handle("desktop:github-write-markdown", async (_event, repoFullName, branch, files) => {
    return githubWriteMarkdown(repoFullName, branch, files);
  });

  ipcMain.handle("desktop:auth-load-session-token", async () => {
    return loadSecret("ethical-world.session");
  });

  ipcMain.handle("desktop:auth-store-session-token", async (_event, token) => {
    const value = String(token ?? "");
    if (!value || value.length > 2048) throw new Error("Invalid session token.");
    await saveSecret("ethical-world.session", value);
    return true;
  });

  ipcMain.handle("desktop:auth-clear-session-token", async () => {
    await deleteSecret("ethical-world.session");
    return true;
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
