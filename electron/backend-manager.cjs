const { spawn } = require("node:child_process");
const { verifyBackend } = require("./backend-runtime.cjs");
const { stopBackendProcess } = require("./backend-process.cjs");

function createBackendManager({ getCandidates, token, port = 8787, env = process.env,
  getEnv = async () => ({}),
  spawnProcess = spawn, verify = verifyBackend, stopProcess = stopBackendProcess,
  writeLog = async () => {}, startupMs = 45000, pollMs = 250,
  now = Date.now, pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms)) }) {
  const backendPort = Number(port);
  if (!Number.isInteger(backendPort) || backendPort < 1 || backendPort > 65535) throw new Error("Invalid backend port.");
  const baseUrl = "http://127.0.0.1:" + backendPort;
  const secrets = [token, ...Object.entries(env).filter(([key]) => /TOKEN|SECRET|PASSWORD|KEY/i.test(key)).map(([, value]) => value)]
    .filter((value) => typeof value === "string" && value.length > 0);
  const redact = (value) => {
    let text = String(value ?? "");
    for (const secret of secrets) text = text.split(secret).join("[redacted]");
    return text.replace(/Bearer\s+[^\s"']+/gi, "Bearer [redacted]").slice(-8192);
  };
  let owned = null;
  let source = "offline";
  let message = "Backend aplikace se připravuje.";
  let flight = null;
  let closing = false;
  let events = [];
  let logQueue = Promise.resolve();
  const stops = new WeakMap();

  function record(event, detail = {}) {
    events = [...events.slice(-15), { at: new Date(now()).toISOString(), event, ...detail }];
    const snapshot = events;
    logQueue = logQueue.then(() => writeLog(snapshot)).catch(() => undefined);
  }

  async function healthy() {
    if (closing) return false;
    try { return await verify(baseUrl, token); } catch { return false; }
  }

  function halt(child) {
    if (!child) return Promise.resolve();
    if (stops.has(child)) return stops.get(child);
    const task = Promise.resolve().then(() => stopProcess(child));
    stops.set(child, task);
    return task;
  }

  async function attempt(candidate) {
    let child;
    let ready = false;
    let stderr = "";
    let spawnError = null;
    try {
      const extraEnv = await getEnv();
      if (closing) throw new Error("Aplikace se ukončuje.");
      for (const [key, value] of Object.entries(extraEnv)) {
        if (/TOKEN|SECRET|PASSWORD|KEY/i.test(key) && typeof value === "string") secrets.push(value);
      }
      child = spawnProcess(candidate.command, candidate.args, {
        cwd: candidate.cwd, windowsHide: true, stdio: ["pipe", "ignore", "pipe"],
        env: { ...env, ...extraEnv, PYTHONUNBUFFERED: "1", ETHICAL_WORLD_PORT: String(backendPort),
          ETHICAL_WORLD_RUNTIME_TOKEN: token, ETHICAL_WORLD_PARENT_PIPE: "1" }
      });
      owned = child;
      source = candidate.source;
      child.stdin?.on("error", () => {});
      child.stderr?.on("data", (chunk) => { stderr = (stderr + chunk.toString()).slice(-16384); });
      child.on("error", (error) => { spawnError = error; });
      await new Promise((resolve) => {
        const spawned = () => { child.removeListener("error", failed); resolve(); };
        const failed = () => { child.removeListener("spawn", spawned); resolve(); };
        child.once("spawn", spawned);
        child.once("error", failed);
      });
      record("spawn", { source });
      const deadline = now() + startupMs;
      while (!closing && !spawnError && child.exitCode === null && child.signalCode === null && now() < deadline) {
        if (await healthy()) {
          if (closing || child.exitCode !== null || child.signalCode !== null) break;
          ready = true;
          message = "Backend aplikace je připravený.";
          record("ready", { source });
          child.once("exit", (code, signal) => {
            if (owned !== child || closing) return;
            source = "offline";
            message = "Backend aplikace se ukončil. Zkusím jej znovu spustit při další zprávě nebo kontrole.";
            record("exit", { source: candidate.source, code, signal, stderr: redact(stderr) });
          });
          return true;
        }
        await pause(Math.min(pollMs, Math.max(0, deadline - now())));
      }
      const reason = closing ? "Aplikace se ukončuje." : spawnError ? redact(spawnError.message)
        : child.exitCode !== null || child.signalCode !== null
          ? `Backend se ukončil před spuštěním (kód ${child.exitCode ?? child.signalCode}).`
          : `Backend neodpověděl do ${startupMs / 1000} s. Port ${backendPort} může být obsazený.`;
      message = reason;
      record("failed", { source: candidate.source, reason, stderr: redact(stderr) });
      return false;
    } catch (error) {
      message = redact(error.message);
      record("failed", { source: candidate.source, reason: message, stderr: redact(stderr) });
      return false;
    } finally {
      if (!ready && child) {
        await halt(child);
        if (owned === child) owned = null;
      }
    }
  }

  function result(ready) {
    return { state: ready ? "ready" : "error", source, message };
  }

  async function ensure() {
    if (closing) return { state: "error", source: "offline", message: "Aplikace se ukončuje." };
    if (flight) return flight;
    flight = (async () => {
      if (await healthy()) return result(true);
      await halt(owned);
      owned = null;
      events = [];
      message = "Spouštím backend aplikace…";
      const candidates = getCandidates();
      for (const candidate of candidates) {
        if (closing) break;
        if (await attempt(candidate)) return result(true);
      }
      source = "offline";
      if (!candidates.length) message = "Backend aplikace chybí v instalaci. Spusť aktualizaci přes launcher.";
      return result(false);
    })().catch((error) => {
      source = "offline";
      message = redact(error.message);
      record("failed", { reason: message });
      return result(false);
    });
    try { return await flight; }
    finally { flight = null; await logQueue; }
  }

  async function stop() {
    closing = true;
    await halt(owned);
    if (flight) await flight;
    owned = null;
  }

  return { baseUrl, ensure, healthy, stop,
    status: async () => ({ backendOnline: await healthy(), backendSource: source, backendMessage: message }) };
}

module.exports = { createBackendManager };
