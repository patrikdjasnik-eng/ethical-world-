const { execFile } = require("node:child_process");
const pendingStops = new WeakMap();

function stopBackendProcess(child, { platform = process.platform, timeoutMs = 4000, execute = execFile } = {}) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return Promise.resolve();
  if (pendingStops.has(child)) return pendingStops.get(child);
  const task = new Promise((resolve, reject) => {
    let timeout;
    const done = () => {
      clearTimeout(timeout);
      child.removeListener("exit", done);
      resolve();
    };
    child.once("exit", done);
    timeout = setTimeout(() => {
      if (child.exitCode !== null || child.signalCode !== null) return done();
      if (platform === "win32" && Number.isInteger(child.pid) && child.pid > 0) {
        execute("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true, timeout: 3000 }, (error) => {
          if (error && child.exitCode === null && child.signalCode === null) {
            child.removeListener("exit", done);
            reject(error);
          } else done();
        });
      } else {
        try { child.kill("SIGTERM"); done(); }
        catch (error) { child.removeListener("exit", done); reject(error); }
      }
    }, timeoutMs);
    // EOF dovolí Python serveru skončit i při pádu Electron parent procesu.
    child.stdin?.end();
  });
  pendingStops.set(child, task);
  task.finally(() => pendingStops.delete(child)).catch(() => undefined);
  return task;
}

module.exports = { stopBackendProcess };
