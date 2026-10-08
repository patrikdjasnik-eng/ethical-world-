const { app, BrowserWindow, Menu, dialog, ipcMain, safeStorage, shell } = require("electron");
const path = require("node:path");
const fs = require("node:fs/promises");
const fsSync = require("node:fs");
const crypto = require("node:crypto");
const { createSecureStore, createSigner } = require("./secure-store.cjs");
const { gatewayRequest, gatewayStreamRequest } = require("./backend-runtime.cjs");
const chatStreams = new Map();
const gatewayRequests = new Map();
function cancelRequests() {
  for (const controller of [...chatStreams.values(), ...gatewayRequests.values()]) controller.abort();
}
const { createBackendManager } = require("./backend-manager.cjs");
const { createModelRuntime } = require("./model-runtime.cjs");
const modelRuntime = createModelRuntime();
const { isAllowedExternalUrl, isTrustedRendererUrl, isTrustedMainFrame } = require("./security.cjs");
const { createTokenPrompt } = require("./github-auth.cjs");
const { createGitHubAuthRuntime } = require("./github-auth-runtime.cjs");

const squirrelStartup = require("electron-squirrel-startup");
const { updateElectronApp, UpdateSourceType } = require("update-electron-app");

let research = null;
function researchStore() {
  if (!research) research = require("./research-runtime.cjs").createResearchRuntime({ directory: path.join(app.getPath("userData"), "research") });
  return research;
}
let mainWindow = null;
const requestGitHubToken = createTokenPrompt({ BrowserWindow, ipcMain, owner: () => mainWindow, directory: __dirname });
const markdownRoots = new Map();
const markdownBaselines = new Map();
const githubBaselines = new Map();
const connectorQueues = new Map();
const { contentHash, writeMarkdownBatch } = require("./markdown-writer.cjs");
function serialConnector(id, operation) {
  const task = (connectorQueues.get(id) ?? Promise.resolve()).catch(() => undefined).then(operation);
  connectorQueues.set(id, task);
  void task.finally(() => { if (connectorQueues.get(id) === task) connectorQueues.delete(id); }).catch(() => undefined);
  return task;
}
const ignoredMarkdownDirs = new Set([".git", "node_modules", ".venv", "venv", "dist", "out", "build"]);
const githubClientId = String(
  process.env.ETHICAL_GITHUB_CLIENT_ID ?? ""
).trim();
const githubAuth = createGitHubAuthRuntime({
  clientId: githubClientId,
  saveToken: (token) => saveSecret("github.oauth", token),
  deleteToken: () => deleteSecret("github.oauth"),
  loadToken: () => loadSecret("github.oauth"),
  requestToken: requestGitHubToken,
  openVerification: (url) => shell.openExternal(url),
  confirmStart: async ({ clientId, scope }) => {
    const permission = scope === "repo"
      ? "Čtení a zápis veřejných i soukromých repozitářů (repo). Tento scope zahrnuje i správu hooks a dalších repo oprávnění."
      : "Čtení a zápis veřejných repozitářů (public_repo).";
    const result = await dialog.showMessageBox(mainWindow, {
      type: "warning", title: "Připojit GitHub", buttons: ["Zrušit", "Pokračovat na GitHub"], defaultId: 0, cancelId: 0,
      message: "Povolit přihlášení přes vlastní GitHub OAuth aplikaci?",
      detail: `Client ID: ${clientId}\n${permission}\n\nOtevře se https://github.com/login/device. Zadej pouze kód z tohoto přihlášení a ověř název vlastní OAuth aplikace na GitHubu. Kódy ze zpráv, poznámek nebo chatu nepoužívej.`,
    });
    return result.response === 1;
  },
  confirmDeviceCode: async ({ userCode }) => {
    const result = await dialog.showMessageBox(mainWindow, {
      type: "info", title: "GitHub přihlašovací kód", buttons: ["Zrušit", "Otevřít GitHub"], defaultId: 0, cancelId: 0,
      message: `Kód pro toto přihlášení: ${userCode}`,
      detail: "Na https://github.com/login/device použij přesně tento kód a ověř název své OAuth aplikace. Kód dodaný chatem nebo jinou zprávou nepoužívej.",
    });
    return result.response === 1;
  },
  confirmAccount: async ({ login, scopes }) => {
    const result = await dialog.showMessageBox(mainWindow, {
      type: "question", title: "Potvrdit GitHub účet", buttons: ["Zrušit", "Připojit účet"], defaultId: 0, cancelId: 0,
      message: `Připojit ověřený účet @${login}?`, detail: `Oprávnění: ${scopes}\nToken se uloží přes OS secure storage.`,
    });
    return result.response === 1;
  },
});
const githubApiVersion = "2026-03-10";
const backendToken = crypto.randomBytes(48).toString("base64url");
let secureStore = null;
let carrotSigner = null;
function secretsStore() {
  if (!secureStore) secureStore = createSecureStore(secretFilePath(), safeStorage);
  return secureStore;
}
function signerStore() {
  if (!carrotSigner) carrotSigner = createSigner(secretsStore());
  return carrotSigner;
}
function backendCandidates() {
  const candidates = [];

  if (app.isPackaged) {
    const bundledExe = path.join(process.resourcesPath, "backend", "EthicalWorldBackend.exe");
    if (fsSync.existsSync(bundledExe)) {
      candidates.push({ source: "bundled", command: bundledExe, args: [], cwd: path.dirname(bundledExe) });
    }
    candidates.push({
      source: "python", command: "python",
      args: ["-m", "server.desktop_entry"],
      cwd: process.resourcesPath
    });
    candidates.push({
      source: "py", command: "py",
      args: ["-3", "-m", "server.desktop_entry"],
      cwd: process.resourcesPath
    });
    return candidates;
  }

  const projectRoot = path.resolve(__dirname, "..");
  const venvPython = process.platform === "win32"
    ? path.join(projectRoot, ".venv", "Scripts", "python.exe")
    : path.join(projectRoot, ".venv", "bin", "python");
  if (fsSync.existsSync(venvPython)) {
    candidates.push({
      source: "venv", command: venvPython,
      args: ["-m", "server.desktop_entry"],
      cwd: projectRoot
    });
  }
  candidates.push({
    source: "python", command: "python",
    args: ["-m", "server.desktop_entry"],
    cwd: projectRoot
  });
  return candidates;
}

function backendLogPath() {
  return path.join(app.getPath("userData"), "logs", "backend-startup.log");
}

let connectorKeyProvider;
const backendRuntime = createBackendManager({
  getEnv: async () => {
    if (process.env.ETHICAL_WORLD_CONNECTOR_KEY) return {};
    const directory = process.env.ETHICAL_WORLD_DATA_DIR ?? path.join(require("node:os").homedir(), ".ethical-world");
    if (!(process.env.ETHICAL_NOTION_CLIENT_ID && process.env.ETHICAL_NOTION_CLIENT_SECRET) && !fsSync.existsSync(path.join(directory, "connector.key"))) return {};
    if (!connectorKeyProvider) connectorKeyProvider = require("./connector-key.cjs").createConnectorKeyProvider({
      store: secretsStore(), directory
    });
    return connectorKeyProvider();
  },
  getCandidates: backendCandidates, token: backendToken,
  port: process.env.ETHICAL_WORLD_DESKTOP_PORT ?? 8787,
  startupMs: app.isPackaged ? 45000 : 15000,
  writeLog: async (events) => {
    const logfile = backendLogPath();
    await fs.mkdir(path.dirname(logfile), { recursive: true });
    await fs.writeFile(logfile, JSON.stringify(events, null, 2), "utf8");
  }
});

function trustedRendererUrl(rawUrl) {
  return isTrustedRendererUrl(rawUrl, {
    packaged: app.isPackaged,
    distDir: path.join(__dirname, "..", "dist"),
    devOrigins: ["http://127.0.0.1:5173", "http://localhost:5173"]
  });
}

function assertTrustedRenderer(event) {
  const senderUrl = event.senderFrame?.url || event.sender?.getURL?.() || "";
  if (!isTrustedMainFrame(event, mainWindow?.webContents) || !trustedRendererUrl(senderUrl)) {
    throw new Error("Blocked IPC call from an untrusted renderer.");
  }
}

function handleTrusted(channel, handler) {
  ipcMain.handle(channel, async (event, ...args) => {
    assertTrustedRenderer(event);
    return handler(event, ...args);
  });
}

function openExternalSafe(rawUrl) {
  if (!isAllowedExternalUrl(rawUrl)) return false;
  void shell.openExternal(String(rawUrl));
  return true;
}

function secretFilePath() {
  return path.join(app.getPath("userData"), "secrets.json");
}

async function saveSecret(name, value) {
  return secretsStore().save(name, value);
}

async function loadSecret(name) {
  return secretsStore().load(name);
}

async function deleteSecret(name) {
  return secretsStore().delete(name);
}

async function carrotSignPayload(payload) {
  return signerStore().sign(payload);
}

async function carrotVerifyPayload(payload, signature, publicKey) {
  return signerStore().verify(payload, signature, publicKey);
}

async function githubRequest(apiPath, options = {}) {
  const token = await loadSecret("github.oauth");
  if (!token) throw new Error("GitHub není připojený.");

  const response = await fetch("https://api.github.com" + apiPath, {
    ...options,
    signal: AbortSignal.timeout(30000),
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
      await githubAuth.dropRejectedToken(token);
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

  githubBaselines.set(githubConnectionId(safeRepo, branch), new Map(blobs.map((entry) => [entry.path, entry.sha])));
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

  if (!Array.isArray(rawFiles) || rawFiles.length > 500) throw new Error("GitHub export je omezený na 500 souborů; vyber menší sadu.");
  const files = rawFiles;
  const currentTree = await githubRequest("/repos/" + safeRepo + "/git/trees/" + baseTreeSha + "?recursive=1");
  if (currentTree.truncated) throw new Error("GitHub tree je příliš velký pro bezpečnou kontrolu konfliktů.");
  const currentShas = new Map((currentTree.tree ?? []).filter((entry) => entry.type === "blob").map((entry) => [entry.path, entry.sha]));
  const baseline = githubBaselines.get(githubConnectionId(safeRepo, branch)) ?? new Map();
  const paths = new Set();
  for (const file of files) {
    const relativePath = String(file?.relativePath ?? "");
    if (!/\.(md|mdx)$/i.test(relativePath) || relativePath.split("/").some((part) => !part || part === "." || part === "..") || relativePath.includes("\\")) throw new Error("Invalid GitHub Markdown path.");
    if (typeof file.content !== "string" || Buffer.byteLength(file.content) > 2 * 1024 * 1024 || paths.has(relativePath)) throw new Error("Invalid GitHub export content.");
    paths.add(relativePath);
    if ((currentShas.get(relativePath) ?? null) !== (baseline.get(relativePath) ?? null)) throw new Error("Konflikt: „" + relativePath + "“ se v GitHubu změnil nebo nebyl importovaný.");
  }
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

  for (const entry of treeEntries) baseline.set(entry.path, entry.sha);
  githubBaselines.set(githubConnectionId(safeRepo, branch), baseline);
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

if (!squirrelStartup && app.requestSingleInstanceLock()) {
  if (process.platform === "win32") {
    app.setAppUserModelId("com.squirrel.ethical_world.EthicalWorld");
  }

  // Public update service cannot authenticate private GitHub releases.
  if (app.isPackaged && process.env.ETHICAL_WORLD_PUBLIC_UPDATES === "1") {
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
      icon: path.join(__dirname, "..", "assets", "icons", process.platform === "win32" ? "EthicalWorld.ico" : "EthicalWorld.png"),
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

    mainWindow.once("closed", () => { githubAuth.cancel(); cancelRequests(); mainWindow = null; });
    mainWindow.webContents.on("render-process-gone", () => { githubAuth.cancel(); cancelRequests(); });
    mainWindow.webContents.on("did-start-navigation", (_event, _url, _inPlace, isMainFrame) => { if (isMainFrame) { githubAuth.cancel(); cancelRequests(); } });
    mainWindow.once("ready-to-show", () => {
      mainWindow?.show();
    });

    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      openExternalSafe(url);
      return { action: "deny" };
    });

    mainWindow.webContents.on("will-navigate", (event, url) => {
      event.preventDefault();
      openExternalSafe(url);
    });

    mainWindow.webContents.on("will-attach-webview", (event) => {
      event.preventDefault();
    });

    if (app.isPackaged) {
      void mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
    } else {
      void mainWindow.loadURL("http://127.0.0.1:5173");
    }
  }

  handleTrusted("desktop:context-menu", async (event, rawItems) => {
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

  handleTrusted("desktop:select-vault-folder", async () => {
    const result = await dialog.showOpenDialog(mainWindow ?? undefined, {
      title: "Vyber Ethical World vault",
      properties: ["openDirectory", "createDirectory"]
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  });

  handleTrusted("desktop:select-markdown-folder", async () => {
    const result = await dialog.showOpenDialog(mainWindow ?? undefined, {
      title: "Vyber Markdown / VS Code workspace",
      properties: ["openDirectory", "createDirectory"]
    });

    if (result.canceled || result.filePaths.length === 0) return null;
    return registerMarkdownRoot(await fs.realpath(result.filePaths[0]));
  });

  handleTrusted("desktop:read-markdown-files", async (_event, connectionId) => {
    return serialConnector(connectionId, async () => {
      const result = await collectMarkdownFiles(getMarkdownRoot(connectionId));
      markdownBaselines.set(connectionId, new Map(result.files.map((file) => [file.relativePath, contentHash(file.content)])));
      return result;
    });
  });

  handleTrusted("desktop:write-markdown-files", async (_event, connectionId, files) => {
    return serialConnector(connectionId, () => writeMarkdownBatch(
      getMarkdownRoot(connectionId), files, markdownBaselines.get(connectionId) ?? new Map()
    ));
  });

  handleTrusted("desktop:github-status", async () => {
    const token = await loadSecret("github.oauth");
    if (!token) return { configured: githubAuth.configured, connected: false, login: null };

    try {
      const user = await githubRequest("/user");
      return { configured: githubAuth.configured, connected: true, login: user.login ?? null };
    } catch {
      return { configured: githubAuth.configured, connected: false, login: null };
    }
  });

  handleTrusted("desktop:github-start-login", async (_event, scope) => githubAuth.start(scope));
  handleTrusted("desktop:github-connect-token", async () => githubAuth.connectToken());
  handleTrusted("desktop:github-poll-login", async (_event, sessionId) => githubAuth.poll(sessionId));
  handleTrusted("desktop:github-cancel-login", async (_event, sessionId) => { githubAuth.cancel(sessionId); return true; });
  handleTrusted("desktop:github-disconnect", async () => githubAuth.disconnect());

  handleTrusted("desktop:github-list-repos", async () => {
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

  handleTrusted("desktop:github-read-markdown", async (_event, repoFullName, branch) => {
    return serialConnector(githubConnectionId(repoFullName, branch), () => githubMarkdownFiles(repoFullName, branch));
  });

  handleTrusted("desktop:github-write-markdown", async (_event, repoFullName, branch, files) => {
    return serialConnector(githubConnectionId(repoFullName, branch), () => githubWriteMarkdown(repoFullName, branch, files));
  });

  handleTrusted("desktop:auth-load-session-token", async () => {
    return loadSecret("ethical-world.session");
  });

  handleTrusted("desktop:auth-store-session-token", async (_event, token) => {
    const value = String(token ?? "");
    if (!value || value.length > 2048) throw new Error("Invalid session token.");
    await saveSecret("ethical-world.session", value);
    return true;
  });

  handleTrusted("desktop:auth-clear-session-token", async () => {
    await deleteSecret("ethical-world.session");
    return true;
  });

  handleTrusted("desktop:carrot-sign", async (_event, payload) => {
    return carrotSignPayload(payload);
  });

  handleTrusted("desktop:carrot-verify", async (_event, payload, signature, publicKey) => {
    return carrotVerifyPayload(payload, signature, publicKey);
  });

  handleTrusted("desktop:research-start", async (_event, urls) => researchStore().start(urls));
  handleTrusted("desktop:research-list", async () => researchStore().list());
  handleTrusted("desktop:research-read", async (_event, id) => researchStore().read(id));
  handleTrusted("desktop:research-cancel", async (_event, id) => researchStore().cancel(id));
  handleTrusted("desktop:research-remove", async (_event, id) => researchStore().remove(id));

  handleTrusted("desktop:gateway-request", async (_event, request) => {
    const id = request?.id;
    if (typeof id !== "string" || !/^[a-z0-9-]{1,80}$/i.test(id) || gatewayRequests.has(id) || gatewayRequests.size >= 64) throw new Error("Blocked gateway session.");
    const controller = new AbortController();
    gatewayRequests.set(id, controller);
    try {
      if (request.path !== "/health") {
        const runtime = await backendRuntime.ensure();
        controller.signal.throwIfAborted();
        if (runtime.state !== "ready") throw new Error(runtime.message);
      }
      return await gatewayRequest(backendRuntime.baseUrl, backendToken, request, controller.signal);
    } finally {
      gatewayRequests.delete(id);
    }
  });

  handleTrusted("desktop:gateway-request-cancel", async (_event, id) => {
    if (typeof id === "string") gatewayRequests.get(id)?.abort();
  });

  handleTrusted("desktop:gateway-stream", async (event, id, request) => {
    if (typeof id !== "string" || !/^[a-z0-9-]{1,80}$/i.test(id) || chatStreams.has(id) || chatStreams.size >= 2) throw new Error("Blocked stream session.");
    const controller = new AbortController();
    chatStreams.set(id, controller);
    const destroyed = () => controller.abort();
    event.sender.once("destroyed", destroyed);
    try {
      const runtime = await backendRuntime.ensure();
      if (controller.signal.aborted) throw new DOMException("Aborted", "AbortError");
      if (runtime.state !== "ready") throw new Error(runtime.message);
      return await gatewayStreamRequest(backendRuntime.baseUrl, backendToken, request, (data) => {
        if (!event.sender.isDestroyed()) event.sender.send("desktop:gateway-stream-event", id, data);
      }, controller.signal);
    } finally {
      event.sender.removeListener("destroyed", destroyed);
      chatStreams.delete(id);
    }
  });

  handleTrusted("desktop:gateway-stream-cancel", async (_event, id) => {
    if (typeof id === "string") chatStreams.get(id)?.abort();
  });

  handleTrusted("desktop:ensure-local-model", async (_event, request) => modelRuntime.ensure(request ?? {}));
  handleTrusted("desktop:ensure-backend", async () => backendRuntime.ensure());

  handleTrusted("desktop:carrot-confirm-saved", async (_event, payload, signature, publicKey) => {
    return signerStore().confirm(payload, signature, publicKey);
  });

  handleTrusted("desktop:carrot-verify-head", async (_event, noteId, commitHash) => {
    return signerStore().verifyHead(String(noteId), String(commitHash));
  });

  handleTrusted("desktop:runtime-status", async () => ({
    ...await backendRuntime.status(),
    backendLogPath: backendLogPath(),
    githubClientConfigured: githubAuth.configured
  }));

  app.on("second-instance", () => {
    if (mainWindow?.isMinimized()) mainWindow.restore();
    mainWindow?.show();
    mainWindow?.focus();
  });

  app.whenReady().then(() => {
    void backendRuntime.ensure();
    createWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });

  let backendStopped = false;
  let backendStopping = false;
  app.on("before-quit", (event) => {
    if (backendStopped) return;
    event.preventDefault();
    if (backendStopping) return;
    backendStopping = true;
    githubAuth.cancel();
    cancelRequests();
    void Promise.all([backendRuntime.stop(), modelRuntime.stop(), research?.stop()]).then(() => {
      backendStopped = true;
      app.quit();
    }).catch((error) => {
      backendStopping = false;
      dialog.showErrorBox("Backend shutdown failed", String(error));
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });
}

if (!squirrelStartup && !app.hasSingleInstanceLock()) app.quit();
