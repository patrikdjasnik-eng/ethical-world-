const path = require("node:path");
const { fileURLToPath } = require("node:url");

function isAllowedExternalUrl(rawUrl) {
  try {
    const url = new URL(String(rawUrl ?? ""));
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function isInside(basePath, candidatePath) {
  const relative = path.relative(path.resolve(basePath), path.resolve(candidatePath));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function isTrustedMainFrame(event, webContents) {
  return Boolean(webContents && event.sender === webContents && event.senderFrame && event.senderFrame === webContents.mainFrame);
}

function isTrustedRendererUrl(rawUrl, options) {
  const value = String(rawUrl ?? "");
  if (!value) return false;

  try {
    const url = new URL(value);

    if (!options.packaged) {
      return options.devOrigins.includes(url.origin);
    }

    if (url.protocol !== "file:") return false;
    return isInside(options.distDir, fileURLToPath(url));
  } catch {
    return false;
  }
}

module.exports = {
  isAllowedExternalUrl,
  isInside,
  isTrustedMainFrame,
  isTrustedRendererUrl
};
