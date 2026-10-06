const crypto = require("node:crypto");
const net = require("node:net");

const gatewayPaths = new Set([
  "/api/auth/register", "/api/auth/bootstrap-owner", "/api/auth/login", "/api/auth/change-password", "/api/auth/me", "/api/auth/logout",
  "/api/connectors/notion/start", "/api/connectors/notion/status", "/api/connectors/notion/pages", "/api/connectors/notion/read", "/api/connectors/notion/write", "/api/connectors/notion/disconnect",
  "/api/providers/detect", "/api/providers/status", "/api/providers/auto-detect", "/api/chat", "/health"
]);

async function reservePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

async function verifyBackend(baseUrl, token) {
  try {
    const challenge = crypto.randomBytes(32).toString("hex");
    const response = await fetch(baseUrl + "/health?challenge=" + challenge, { signal: AbortSignal.timeout(1500), redirect: "error" });
    const payload = await response.json();
    const expected = crypto.createHmac("sha256", token).update(challenge).digest();
    const supplied = Buffer.from(String(payload.proof ?? ""), "hex");
    return response.ok && supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);
  } catch { return false; }
}

async function gatewayRequest(baseUrl, token, request) {
  if (!request || !gatewayPaths.has(request.path) || !["GET", "POST"].includes(request.method)) throw new Error("Blocked gateway request.");
  const body = request.body;
  if (body !== undefined && (typeof body !== "string" || Buffer.byteLength(body) > 2 * 1024 * 1024)) throw new Error("Gateway payload je příliš velký.");
  if (!await verifyBackend(baseUrl, token)) throw new Error("Backend identity verification failed.");
  const headers = { "X-Ethical-Capability": token, "Content-Type": "application/json" };
  const authorization = request.headers?.Authorization ?? request.headers?.authorization;
  if (typeof authorization === "string" && authorization.length <= 2048) headers.Authorization = authorization;
  const response = await fetch(baseUrl + request.path, {
    method: request.method, headers,
    body: request.method === "POST" ? body : undefined,
    signal: AbortSignal.timeout(request.path === "/api/chat" ? 250000 : 60000),
    redirect: "error"
  });
  const reader = response.body?.getReader();
  const chunks = [];
  let length = 0;
  if (reader) {
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        length += value.length;
        if (length > 2 * 1024 * 1024) throw new Error("Gateway response je příliš velká.");
        chunks.push(Buffer.from(value));
      }
    } finally { await reader.cancel(); }
  }
  return { status: response.status, body: Buffer.concat(chunks).toString("utf8") };
}

module.exports = { reservePort, verifyBackend, gatewayRequest };
