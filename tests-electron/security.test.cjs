const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const {
  isAllowedExternalUrl,
  isInside,
  isTrustedMainFrame,
  isTrustedRendererUrl
} = require("../electron/security.cjs");

test("privileged IPC requires the owned main frame, including same-origin subframes", () => {
  const webContents = { mainFrame: {} };
  assert.equal(isTrustedMainFrame({ sender: webContents, senderFrame: webContents.mainFrame }, webContents), true);
  assert.equal(isTrustedMainFrame({ sender: webContents, senderFrame: {} }, webContents), false);
  assert.equal(isTrustedMainFrame({ sender: webContents }, webContents), false);
  assert.equal(isTrustedMainFrame({ sender: {}, senderFrame: webContents.mainFrame }, webContents), false);
  assert.equal(isTrustedMainFrame({}, undefined), false);
});

test("external URL policy only permits http(s)", () => {
  assert.equal(isAllowedExternalUrl("https://example.com/path"), true);
  assert.equal(isAllowedExternalUrl("http://127.0.0.1:8787/health"), true);
  assert.equal(isAllowedExternalUrl("javascript:alert(1)"), false);
  assert.equal(isAllowedExternalUrl("data:text/html,hello"), false);
  assert.equal(isAllowedExternalUrl("file:///tmp/secret.txt"), false);
});

test("development renderer must use an explicitly allowed origin", () => {
  const options = {
    packaged: false,
    distDir: path.resolve("/tmp/app/dist"),
    devOrigins: ["http://127.0.0.1:5173", "http://localhost:5173"]
  };

  assert.equal(isTrustedRendererUrl("http://127.0.0.1:5173/", options), true);
  assert.equal(isTrustedRendererUrl("http://127.0.0.1:5173/note", options), true);
  assert.equal(isTrustedRendererUrl("https://evil.example/", options), false);
  assert.equal(isTrustedRendererUrl("http://127.0.0.1.evil.example:5173/", options), false);
});

test("packaged renderer is restricted to files under dist", () => {
  const distDir = path.resolve("/tmp/ethical-world/dist");
  const inside = pathToFileURL(path.join(distDir, "index.html")).href;
  const nested = pathToFileURL(path.join(distDir, "assets", "app.js")).href;
  const outside = pathToFileURL(path.resolve("/tmp/ethical-world/secrets.html")).href;

  const options = { packaged: true, distDir, devOrigins: [] };

  assert.equal(isTrustedRendererUrl(inside, options), true);
  assert.equal(isTrustedRendererUrl(nested, options), true);
  assert.equal(isTrustedRendererUrl(outside, options), false);
  assert.equal(isTrustedRendererUrl("https://example.com/", options), false);
});

test("path containment rejects sibling and parent paths", () => {
  const root = path.resolve("/tmp/vault");
  assert.equal(isInside(root, path.join(root, "notes", "a.md")), true);
  assert.equal(isInside(root, path.resolve("/tmp/vault-evil/a.md")), false);
  assert.equal(isInside(root, path.resolve("/tmp/a.md")), false);
});
