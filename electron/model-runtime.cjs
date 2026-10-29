const fs = require("node:fs/promises");
const path = require("node:path");
const { spawn, execFile } = require("node:child_process");

function localOllamaUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname) &&
      url.port === "11434" && !url.username && !url.password && !url.search && !url.hash && url.pathname === "/";
  } catch { return false; }
}

async function ollamaExecutable(platform, env) {
  if (platform !== "win32") return "ollama";
  const candidates = [
    env.LOCALAPPDATA && path.join(env.LOCALAPPDATA, "Programs", "Ollama", "ollama.exe"),
    env.ProgramFiles && path.join(env.ProgramFiles, "Ollama", "ollama.exe")
  ].filter(Boolean);
  for (const candidate of candidates) {
    if ((await fs.stat(candidate).catch(() => null))?.isFile()) return candidate;
  }
  // PATH lookup supports custom installations without executing a shell command.
  return new Promise((resolve) => execFile("where.exe", ["ollama.exe"], { windowsHide: true, timeout: 2000, maxBuffer: 8192 }, (error, stdout) => {
    const candidate = !error && String(stdout).split(/\r?\n/).map((line) => line.trim()).find((line) => path.win32.isAbsolute(line));
    resolve(candidate || null);
  }));
}

function createModelRuntime({ platform = process.platform, env = process.env, fetcher = fetch, spawnProcess = spawn,
  execute = execFile, findExecutable = ollamaExecutable, startupMs = 20000, warmupMs = 60000 } = {}) {
  // All traffic is pinned to IPv4 loopback, regardless of inherited OLLAMA_HOST.
  const baseUrl = "http://127.0.0.1:11434";
  let owned = null;
  let serverFlight = null;
  let closing = false;
  const flights = new Map();
  const warmed = new Map();
  const controllers = new Set();

  async function jsonRequest(suffix, body, timeoutMs) {
    const controller = new AbortController();
    controllers.add(controller);
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetcher(baseUrl + suffix, {
        method: body ? "POST" : "GET", redirect: "error", signal: controller.signal,
        ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {})
      });
      if (!response.ok) throw new Error("Ollama request failed.");
      const reader = response.body.getReader();
      const chunks = [];
      let length = 0;
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          length += value.byteLength;
          if (length > 256 * 1024) throw new Error("Ollama status is too large.");
          chunks.push(Buffer.from(value));
        }
      } finally { await reader.cancel(); }
      return JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } finally {
      clearTimeout(timeout);
      controllers.delete(controller);
    }
  }

  async function probe() {
    try {
      const payload = await jsonRequest("/api/tags", null, 1200);
      return Array.isArray(payload.models) ? payload.models.filter((item) => typeof item?.name === "string").map((item) => item.name).slice(0, 500) : null;
    } catch { return null; }
  }

  async function ensureServer() {
    if (serverFlight) return serverFlight;
    serverFlight = (async () => {
      const existing = await probe();
      if (existing) return existing;
      warmed.clear();
      if (closing) throw new Error("Aplikace se ukončuje.");
      const executable = await findExecutable(platform, env);
      if (!executable) throw new Error("Ollama není nainstalovaná nebo není dostupná v PATH.");
      if (closing) throw new Error("Aplikace se ukončuje.");
      if (!owned || owned.exitCode !== null || owned.signalCode !== null) {
        owned = spawnProcess(executable, ["serve"], {
          windowsHide: true, stdio: "ignore", env: { ...env, OLLAMA_HOST: "127.0.0.1:11434" }
        });
        owned.on("error", () => {});
      }
      const child = owned;
      let spawnFailed = false;
      const markFailed = () => { spawnFailed = true; };
      child.once("error", markFailed);
      try {
        const deadline = Date.now() + startupMs;
        do {
          if (closing) throw new Error("Aplikace se ukončuje.");
          const models = await probe();
          if (models) return models;
          if (spawnFailed || child.exitCode !== null || child.signalCode !== null) break;
          await new Promise((resolve) => setTimeout(resolve, 200));
        } while (Date.now() < deadline);
        throw new Error("Ollama se nepodařila spustit. Zkontroluj instalaci a dostupnost portu 11434.");
      } finally { child.removeListener("error", markFailed); }
    })();
    try { return await serverFlight; }
    finally { serverFlight = null; }
  }

  async function ensure({ model, baseUrl: requestedUrl, warmup = true }) {
    if (!localOllamaUrl(requestedUrl)) return { state: "unsupported", message: "Automatický start podporuje lokální Ollamu na portu 11434." };
    if (typeof model !== "string" || !model.trim() || model.length > 200) return { state: "error", message: "Neplatný název modelu." };
    if (closing) return { state: "error", message: "Aplikace se ukončuje." };
    const prepare = async () => {
      try {
        const models = await ensureServer();
        if (closing) throw new Error("Aplikace se ukončuje.");
        const selected = models.find((name) => name === model || (!model.includes(":") && name === model + ":latest"));
        if (!selected) return { state: "missing", message: `Model „${model}“ není v Ollamě nainstalovaný. Vyber existující model v nastavení.` };
        // Foreground checks start the service and validate the selection. The real chat
        // request loads the model, without queuing behind a separate empty generation.
        if (warmup === false) return { state: "ready", message: "Ollama je dostupná a vybraný model je nainstalovaný.", model: selected };
        if ((warmed.get(selected) ?? 0) < Date.now() - 5 * 60 * 1000) {
          const started = Date.now();
          // An empty generate request loads the model without generating a reply.
          const payload = await jsonRequest("/api/generate", { model: selected, stream: false, keep_alive: "15m" }, warmupMs);
          if (payload.error || payload.done !== true) throw new Error("Model se nepodařilo předehřát.");
          warmed.set(selected, Date.now());
          return { state: "ready", message: "Ollama i model jsou připravené.", model: selected, warmupMs: Date.now() - started };
        }
        return { state: "ready", message: "Ollama i model jsou připravené.", model: selected };
      } catch (error) {
        return { state: "error", message: error?.name === "AbortError" ? "Načítání modelu překročilo časový limit. Zkus kontrolu znovu." : error?.message === "Ollama není nainstalovaná nebo není dostupná v PATH." ? error.message : "Ollama nebo model nejsou připravené. Zkontroluj instalaci a nastavení modelu." };
      }
    };
    if (warmup === false) return prepare();
    const key = model.endsWith(":latest") ? model.slice(0, -7) : model;
    if (flights.has(key)) return flights.get(key);
    if (flights.size) return { state: "error", message: "Právě načítám jiný model. Zkus kontrolu po jeho dokončení." };
    const task = prepare();
    flights.set(key, task);
    try { return await task; }
    finally { flights.delete(key); }
  }

  async function stop() {
    closing = true;
    for (const controller of controllers) controller.abort();
    const child = owned;
    if (!child || !Number.isInteger(child.pid) || child.pid <= 0 || child.exitCode !== null || child.signalCode !== null) return;
    if (platform === "win32") {
      await new Promise((resolve, reject) => execute("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true, timeout: 3000 }, (error) => {
        if (error && child.exitCode === null && child.signalCode === null) reject(error);
        else resolve();
      }));
    } else {
      await new Promise((resolve) => {
        const timeout = setTimeout(() => { child.kill("SIGKILL"); finish(); }, 1500);
        const finish = () => { clearTimeout(timeout); child.removeListener("exit", finish); resolve(); };
        child.once("exit", finish);
        child.kill("SIGTERM");
      });
    }
    owned = null;
  }

  return { ensure, stop };
}

module.exports = { createModelRuntime, localOllamaUrl };
