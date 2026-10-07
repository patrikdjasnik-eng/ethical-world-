import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import type { IncomingMessage, ServerResponse } from "node:http";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const require = createRequire(import.meta.url);
const { gatewayRequest, gatewayOpenResponse } = require("./electron/backend-runtime.cjs") as {
  gatewayRequest: (baseUrl: string, token: string, request: unknown) => Promise<{ status: number; body: string }>;
  gatewayOpenResponse: (baseUrl: string, token: string, request: unknown, signal: AbortSignal) => Promise<Response>;
};

function gatewayProxy(): Plugin {
  let building = false;
  const install = (middlewares: { use: (handler: (request: IncomingMessage, response: ServerResponse, next: () => void) => void) => void }) => {
    middlewares.use((request, response, next) => {
      if (!request.url?.startsWith("/api/") && request.url !== "/health") return next();
      void (async () => {
        const host = request.headers.host ?? "";
        const expected = "http://" + host;
        const hostname = new URL(expected).hostname;
        if (!["localhost", "127.0.0.1", "[::1]"].includes(hostname) ||
            (request.headers.origin && request.headers.origin !== expected) ||
            request.headers["sec-fetch-site"] === "cross-site") {
          response.writeHead(403).end("Cross-origin gateway request blocked.");
          return;
        }
        if (request.method !== "GET" && request.method !== "POST") {
          response.writeHead(405).end();
          return;
        }
        const descriptor = JSON.parse(await readFile(join(process.env.ETHICAL_WORLD_DATA_DIR ?? join(homedir(), ".ethical-world"), "runtime.json"), "utf8")) as { token: string; port: number };
        if (typeof descriptor.token !== "string" || descriptor.token.length < 32 || !Number.isInteger(descriptor.port) || descriptor.port < 1 || descriptor.port > 65535) throw new Error("Invalid runtime descriptor.");
        const chunks: Buffer[] = [];
        let size = 0;
        for await (const chunk of request) {
          size += Buffer.byteLength(chunk);
          if (size > 2 * 1024 * 1024) {
            response.writeHead(413).end();
            return;
          }
          chunks.push(Buffer.from(chunk));
        }
        const controller = new AbortController();
        const cancel = () => { if (!response.writableFinished) controller.abort(); };
        response.once("close", cancel);
        const forwarded = {
          path: request.url,
          method: request.method,
          headers: { Authorization: request.headers.authorization },
          body: request.method === "POST" ? Buffer.concat(chunks).toString("utf8") : undefined
        };
        try {
          if (request.url === "/api/chat/stream") {
            const upstream = await gatewayOpenResponse("http://127.0.0.1:" + descriptor.port, descriptor.token, forwarded, controller.signal);
            response.writeHead(upstream.status, { "Content-Type": upstream.ok ? "application/x-ndjson" : "application/json", "Cache-Control": "no-store", "X-Accel-Buffering": "no" });
            response.flushHeaders();
            if (!upstream.body) throw new Error("Missing backend stream.");
            const reader = upstream.body.getReader();
            async function* chunks() {
              let size = 0;
              try {
                while (true) {
                  const chunk = await reader.read();
                  if (chunk.done) break;
                  size += chunk.value.byteLength;
                  if (size > 2 * 1024 * 1024) throw new Error("Backend stream exceeds limit.");
                  yield Buffer.from(chunk.value);
                }
              } finally { await reader.cancel().catch(() => undefined); }
            }
            await pipeline(Readable.from(chunks()), response, { signal: controller.signal });
          } else {
            const result = await gatewayRequest("http://127.0.0.1:" + descriptor.port, descriptor.token, forwarded);
            response.writeHead(result.status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
            response.end(result.body);
          }
        } finally { response.removeListener("close", cancel); }
      })().catch(() => {
        if (response.headersSent) response.destroy();
        else response.writeHead(503, { "Content-Type": "application/json" }).end(JSON.stringify({ detail: "Ověřený lokální backend není dostupný. Spusť backend ve stejném profilu zařízení." }));
      });
    });
  };
  return {
    name: "ethical-local-gateway",
    configResolved(config) { building = config.command === "build"; },
    async closeBundle() {
      if (!building) return;
      try {
        const assets = (await readdir("dist/assets")).map((file) => "./assets/" + file).sort();
        const html = await readFile("dist/index.html", "utf8");
        const version = createHash("sha256").update(html + JSON.stringify(assets)).digest("hex").slice(0, 12);
        const worker = await readFile("public/sw.js", "utf8");
        await writeFile("dist/sw.js", worker.replace("__CACHE_VERSION__", version).replace("__PRECACHE_JSON__", JSON.stringify(["./", "./ethical-world-mark.svg", "./manifest.webmanifest", ...assets])));
      } catch (error) {
        throw new Error("Offline precache generation failed.", { cause: error });
      }
    },
    configureServer(server) { install(server.middlewares); },
    configurePreviewServer(server) { install(server.middlewares); },
    transformIndexHtml(html, context) {
      const script = context.server ? "'self' 'unsafe-inline'" : "'self'";
      return html.replace("<head>", `<head><meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src ${script}; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' ws://127.0.0.1:5173 ws://localhost:5173; object-src 'none'; base-uri 'none'; form-action 'self'">`);
    }
  };
}

export default defineConfig({
  base: "./",
  plugins: [react(), gatewayProxy()],
  server: { host: "127.0.0.1", port: 5173, strictPort: true },
  preview: { host: "127.0.0.1", port: 4173, strictPort: true }
});
