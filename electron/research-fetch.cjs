const https = require("node:https");
const dns = require("node:dns/promises");
const net = require("node:net");
const ipaddr = require("ipaddr.js");
const cheerio = require("cheerio");
const robotsParser = require("robots-parser");

const userAgent = "EthicalWorldResearch/0.1 (+https://github.com/patrikdjasnik-eng/ethical-world-)";
function publicAddress(address) {
  try { return ipaddr.process(address).range() === "unicast"; } catch { return false; }
}
function validateUrl(value) {
  if (typeof value !== "string" || value.length > 2048) throw new Error("Neplatná URL.");
  const url = new URL(value);
  if (url.href.length > 2048) throw new Error("URL je příliš dlouhá.");
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443") || /(?:^|\.)(?:localhost|local|internal)$/.test(url.hostname)) throw new Error("Výzkum přijímá pouze veřejné HTTPS stránky bez přihlašovacích údajů.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(host) && !publicAddress(host)) throw new Error("Privátní síťové adresy nejsou povolené.");
  url.hash = "";
  return url;
}
async function publicTarget(value, lookup = dns.lookup) {
  const url = validateUrl(value);
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  const records = net.isIP(hostname) ? [{ address: hostname, family: net.isIP(hostname) }] : await lookup(hostname, { all: true, verbatim: true });
  if (!records.length || records.some(({ address }) => !publicAddress(address))) throw new Error("DNS ukazuje na neveřejnou adresu. Požadavek byl zablokován.");
  return { url, records };
}
async function fetchPublic(value, signal, authorizeRedirect, redirects = 0, transport = {}) {
  signal.throwIfAborted();
  const { url, records } = await publicTarget(value, transport.lookup);
  signal.throwIfAborted();
  let result;
  for (const [index, record] of records.entries()) {
    signal.throwIfAborted();
    try {
      result = await new Promise((resolve, reject) => {
        let receivedResponse = false;
        // Každý pokus používá pouze adresu z již ověřeného DNS snapshotu.
        const request = (transport.get ?? https.get)(url, {
          agent: false, signal, timeout: 20000,
          headers: { "User-Agent": userAgent, Accept: "text/html, text/plain", "Accept-Encoding": "identity" },
          lookup: (_hostname, options, callback) => options?.all
            ? callback(null, [record]) : callback(null, record.address, record.family)
        }, (response) => {
          receivedResponse = true;
          let size = 0;
          const chunks = [];
          response.on("error", reject);
          response.on("data", (chunk) => {
            size += chunk.length;
            if (size > 2 * 1024 * 1024) response.destroy(new Error("Stránka překračuje limit 2 MiB."));
            else chunks.push(chunk);
          });
          response.on("end", () => resolve({ status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks).toString("utf8"), url: url.href }));
        });
        request.on("timeout", () => request.destroy(Object.assign(new Error("Stránka neodpověděla do 20 sekund."), { code: "ETIMEDOUT" })));
        request.on("error", (error) => {
          error.retryAddress = !receivedResponse && ["ENETUNREACH", "EHOSTUNREACH", "ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "EADDRNOTAVAIL"].includes(error.code);
          reject(error);
        });
      });
      break;
    } catch (error) {
      signal.throwIfAborted();
      if (!error.retryAddress || index === records.length - 1) throw error;
    }
  }
  if ([301, 302, 303, 307, 308].includes(result.status)) {
    if (redirects >= 3 || !result.headers.location) throw new Error("Příliš mnoho přesměrování.");
    const destination = validateUrl(new URL(result.headers.location, url).href).href;
    if (authorizeRedirect) await authorizeRedirect(destination);
    return fetchPublic(destination, signal, authorizeRedirect, redirects + 1, transport);
  }
  if (result.headers["content-encoding"] && result.headers["content-encoding"] !== "identity") throw new Error("Server ignoroval požadavek na nekomprimovaný obsah.");
  return result;
}
function extractPage(page) {
  const contentType = String(page.headers["content-type"] ?? "");
  if (!/^text\/(?:html|plain)(?:;|$)/i.test(contentType)) throw new Error("Podporované jsou pouze HTML a textové stránky.");
  let title;
  let text;
  if (/^text\/html/i.test(contentType)) {
    const $ = cheerio.load(page.body);
    title = $("title").first().text().trim();
    $("script, style, nav, header, footer, form, iframe, noscript, svg, canvas").remove();
    $("br").replaceWith("\n");
    $("p, h1, h2, h3, h4, li, pre, blockquote").append("\n\n");
    const article = $("main, article").first();
    text = (article.length ? article : $("body")).text();
  } else { text = page.body; }
  text = text.replace(/\r/g, "").replace(/[\t ]+/g, " ").replace(/\n\s*\n(?:\s*\n)+/g, "\n\n").trim();
  const incomplete = text.length > 100000;
  return { title: (title || new URL(page.url).hostname).slice(0, 240), url: page.url, text: text.slice(0, 100000), incomplete, fetchedAt: new Date().toISOString() };
}
async function collectPage(url, signal, download = fetchPublic) {
  signal = AbortSignal.any([signal, AbortSignal.timeout(60000)]);
  const target = validateUrl(url);
  const cache = new Map();
  const authorize = async (destination) => {
    const next = validateUrl(destination);
    const robotsUrl = next.origin + "/robots.txt";
    let rules = cache.get(robotsUrl);
    if (rules === undefined) {
      const robots = await download(robotsUrl, signal);
      if (robots.status !== 200 && robots.status !== 404) throw new Error("Pravidla robots.txt nejsou dostupná; stránka nebyla stažena.");
      rules = robotsParser(robotsUrl, robots.status === 404 ? "" : robots.body);
      cache.set(robotsUrl, rules);
    }
    if (rules.isAllowed(next.href, "EthicalWorldResearch") === false) throw new Error("Stránka zakazuje tento sběr v robots.txt.");
    if (rules.getCrawlDelay("EthicalWorldResearch") > 2) throw new Error("Web požaduje delší crawl-delay. Použij ruční import.");
  };
  await authorize(target.href);
  const page = await download(target.href, signal, authorize);
  if (page.status !== 200) throw new Error("Stránka vrátila HTTP " + page.status + ".");
  return extractPage(page);
}
module.exports = { validateUrl, publicAddress, publicTarget, fetchPublic, extractPage, collectPage };
