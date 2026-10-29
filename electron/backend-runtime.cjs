const crypto = require("node:crypto");
const net = require("node:net");

const gatewayPaths = new Set([
  "/api/auth/register", "/api/auth/bootstrap-owner", "/api/auth/login", "/api/auth/change-password", "/api/auth/me", "/api/auth/logout",
  "/api/connectors/notion/start", "/api/connectors/notion/status", "/api/connectors/notion/pages", "/api/connectors/notion/read", "/api/connectors/notion/write", "/api/connectors/notion/disconnect",
  "/api/providers/detect", "/api/providers/status", "/api/providers/auto-detect", "/api/chat", "/api/chat/stream", "/health"
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

async function verifyBackend(baseUrl, token, signal) {
  try {
    const challenge = crypto.randomBytes(32).toString("hex");
    const response = await fetch(baseUrl + "/health?challenge=" + challenge, { signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(1500)]) : AbortSignal.timeout(1500), redirect: "error" });
    const payload = await response.json();
    const expected = crypto.createHmac("sha256", token).update(challenge).digest();
    const supplied = Buffer.from(String(payload.proof ?? ""), "hex");
    return response.ok && supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);
  } catch { return false; }
}

async function gatewayOpenResponse(baseUrl, token, request, signal) {
  if (!request || !gatewayPaths.has(request.path) || !["GET", "POST"].includes(request.method)) throw new Error("Blocked gateway request.");
  const body = request.body;
  if (body !== undefined && (typeof body !== "string" || Buffer.byteLength(body) > 2 * 1024 * 1024)) throw new Error("Gateway payload je příliš velký.");
  if (!await verifyBackend(baseUrl, token, signal)) {
    signal?.throwIfAborted();
    throw new Error("Backend identity verification failed.");
  }
  const headers = { "X-Ethical-Capability": token, "Content-Type": "application/json" };
  const authorization = request.headers?.Authorization ?? request.headers?.authorization;
  if (typeof authorization === "string" && authorization.length <= 2048) headers.Authorization = authorization;
  const timeout = AbortSignal.timeout(request.path.startsWith("/api/chat") ? 250000 : 60000);
  return fetch(baseUrl + request.path, {
    method: request.method, headers,
    body: request.method === "POST" ? body : undefined,
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    redirect: "error"
  });
}

async function gatewayRequest(baseUrl, token, request, signal) {
  const response = await gatewayOpenResponse(baseUrl, token, request, signal);
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

async function gatewayStreamRequest(baseUrl, token, request, onEvent, signal) {
  if (!request || request.path !== "/api/chat/stream" || request.method !== "POST" || typeof request.body !== "string" || Buffer.byteLength(request.body) > 2 * 1024 * 1024) throw new Error("Blocked streaming request.");
  if (!await verifyBackend(baseUrl, token, signal)) {
    signal?.throwIfAborted();
    throw new Error("Backend identity verification failed.");
  }
  const response = await fetch(baseUrl + request.path, {
    method: "POST", headers: { "X-Ethical-Capability": token, "Content-Type": "application/json" }, body: request.body,
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(250000)]) : AbortSignal.timeout(250000), redirect: "error"
  });
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Backend stream is missing.");
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let pending = "";
  let length = 0;
  let final = false;
  let finalResponse;
  const consume = (line) => {
    if (!line.trim()) return;
    const event = JSON.parse(line);
    if (!event || !["start", "delta", "final", "error"].includes(event.type) || final) throw new Error("Invalid backend stream.");
    if (event.type === "delta" && typeof event.content !== "string") throw new Error("Invalid backend text.");
    if (event.type === "final") { final = true; finalResponse = event.response; }
    if (event.type === "error") throw new Error(typeof event.message === "string" ? event.message : "Provider stream failed.");
    onEvent(event);
  };
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > 2 * 1024 * 1024) throw new Error("Gateway response je příliš velká.");
      pending += decoder.decode(value, { stream: true });
      let newline;
      while (response.ok && (newline = pending.indexOf("\n")) >= 0) {
        consume(pending.slice(0, newline));
        pending = pending.slice(newline + 1);
      }
    }
    pending += decoder.decode();
    if (!response.ok) {
      let detail;
      try { detail = JSON.parse(pending).detail; } catch {}
      throw new Error(typeof detail === "string" ? detail : `AI request failed (${response.status})`);
    }
    consume(pending);
    if (!final) throw new Error("Spojení skončilo před dokončením odpovědi. Nic se neprovedlo.");
    return finalResponse;
  } finally { await reader.cancel(); }
}

module.exports = { reservePort, verifyBackend, gatewayRequest, gatewayOpenResponse, gatewayStreamRequest };
