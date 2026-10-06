const { app, BrowserWindow, Menu, dialog, ipcMain, safeStorage, shell } = require("electron");
const path = require("node:path");
const fs = require("node:fs/promises");
const fsSync = require("node:fs");
const crypto = require("node:crypto");
const { createSecureStore, createSigner } = require("./secure-store.cjs");
const { verifyBackend, gatewayRequest } = require("./backend-runtime.cjs");
const { spawn } = require("node:child_process");
const { isAllowedExternalUrl, isTrustedRendererUrl } = require("./security.cjs");

const squirrelStartup = require("electron-squirrel-startup");
const { updateElectronApp, UpdateSourceType } = require("update-electron-app");

let mainWindow = null;
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
const githubDeviceSessions = new Map();
const githubClientId = String(
  process.env.ETHICAL_GITHUB_CLIENT_ID ?? "Ov23liJffFw6fPudRTQ1"
).trim();
const githubApiVersion = "2026-03-10";
let backendBaseUrl = "";
const backendToken = crypto.randomBytes(48).toString("base64url");
let backendPort = 0;
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
let backendProcess = null;
let backendRuntimeSource = "external";

async function backendHealthy() {
  return Boolean(backendBaseUrl) && verifyBackend(backendBaseUrl, backendToken);
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
      args: ["-m", "uvicorn", "server.main:app", "--host", "127.0.0.1", "--port", String(backendPort)],
      cwd: process.resourcesPath
    });
    candidates.push({
      source: "py", command: "py",
      args: ["-3", "-m", "uvicorn", "server.main:app", "--host", "127.0.0.1", "--port", String(backendPort)],
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
      args: ["-m", "uvicorn", "server.main:app", "--host", "127.0.0.1", "--port", String(backendPort)],
      cwd: projectRoot
    });
  }
  candidates.push({
    source: "python", command: "python",
    args: ["-m", "uvicorn", "server.main:app", "--host", "127.0.0.1", "--port", String(backendPort)],
    cwd: projectRoot
  });
  return candidates;
}

async function waitForBackend(timeoutMs = 9000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await backendHealthy()) return true;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
}

async function startBackendCandidate(candidate) {
  return new Promise((resolve) => {
    let settled = false;
    const child = spawn(candidate.command, candidate.args, {
      cwd: candidate.cwd,
      windowsHide: true,
      stdio: app.isPackaged ? "ignore" : "inherit",
      env: { ...process.env, PYTHONUNBUFFERED: "1", ETHICAL_WORLD_PORT: String(backendPort), ETHICAL_WORLD_RUNTIME_TOKEN: backendToken }
    });
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    child.once("error", () => finish(null));
    child.once("spawn", () => finish(child));
  });
}

async function ensureBackendRuntime() {
  backendPort = Number(process.env.ETHICAL_WORLD_DESKTOP_PORT ?? 8787);
  if (!Number.isInteger(backendPort) || backendPort < 1 || backendPort > 65535) throw new Error("Invalid backend port.");
  backendBaseUrl = "http://127.0.0.1:" + backendPort;
  for (const candidate of backendCandidates()) {
    const child = await startBackendCandidate(candidate);
    if (!child) continue;
    backendProcess = child;
    backendRuntimeSource = candidate.source;
    if (await waitForBackend()) return true;
    try { child.kill(); } catch { }
    backendProcess = null;
  }
  backendRuntimeSource = "offline";
  return false;
}

function stopOwnedBackend() {
  if (!backendProcess) return;
  try { backendProcess.kill(); } catch { }
  backendProcess = null;
}

function trustedRendererUrl(rawUrl) {
  return isTrustedRendererUrl(rawUrl, {
    packaged: app.isPackaged,
    distDir: path.join(__dirname, "..", "dist"),
    devOrigins: ["http://127.0.0.1:5173", "http://localhost:5173"]
  });
}

function assertTrustedRenderer(event) {
  const senderUrl = event.senderFrame?.url || event.sender?.getURL?.() || "";
  if (event.sender !== mainWindow?.webContents || !trustedRendererUrl(senderUrl)) {
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

  handleTrusted("desktop:github-start-login", async () => {
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
      openExternalSafe(payload.verification_uri);
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

  handleTrusted("desktop:github-poll-login", async (_event, sessionId) => {
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

  handleTrusted("desktop:github-disconnect", async () => {
    await deleteSecret("github.oauth");
    return { connected: false };
  });

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

  handleTrusted("desktop:gateway-request", async (_event, request) => {
    return gatewayRequest(backendBaseUrl, backendToken, request);
  });

  handleTrusted("desktop:carrot-confirm-saved", async (_event, payload, signature, publicKey) => {
    return signerStore().confirm(payload, signature, publicKey);
  });

  handleTrusted("desktop:carrot-verify-head", async (_event, noteId, commitHash) => {
    return signerStore().verifyHead(String(noteId), String(commitHash));
  });

  handleTrusted("desktop:runtime-status", async () => ({
    backendOnline: await backendHealthy(),
    backendSource: backendRuntimeSource,
    githubClientConfigured: Boolean(githubClientId)
  }));

  app.on("second-instance", () => {
    if (mainWindow?.isMinimized()) mainWindow.restore();
    mainWindow?.show();
    mainWindow?.focus();
  });

  app.whenReady().then(async () => {
    await ensureBackendRuntime();
    createWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });

  app.on("before-quit", () => {
    stopOwnedBackend();
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });
}

if (!squirrelStartup && !app.hasSingleInstanceLock()) app.quit();
