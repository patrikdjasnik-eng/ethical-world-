const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { BasicCrawler } = require("@crawlee/basic");
const { Configuration, Log } = require("@crawlee/core");
const { validateUrl, collectPage } = require("./research-fetch.cjs");

function createResearchRuntime({ directory, collect = collectPage }) {
  let jobs = [];
  let initial;
  let active = null;
  let closing = false;
  let writes = Promise.resolve();
  let drainFlight = Promise.resolve();
  const filename = path.join(directory, "jobs.json");
  const save = () => {
    const snapshot = JSON.stringify({ version: 1, jobs });
    const task = writes.catch(() => undefined).then(async () => {
      await fs.mkdir(directory, { recursive: true, mode: 0o700 });
      const temporary = filename + "." + crypto.randomUUID() + ".tmp";
      try {
        await fs.writeFile(temporary, snapshot, { mode: 0o600, flag: "wx" });
        await fs.rename(temporary, filename);
      } finally { await fs.rm(temporary, { force: true }); }
    });
    writes = task;
    return task;
  };
  async function load() {
    if (!initial) initial = (async () => {
      try {
        const stat = await fs.stat(filename);
        if (stat.size > 25 * 1024 * 1024) throw new Error("Výzkumná data překračují limit.");
        const data = JSON.parse(await fs.readFile(filename, "utf8"));
        if (data.version !== 1 || !Array.isArray(data.jobs) || data.jobs.length > 20) throw new Error("Neplatná výzkumná data; soubor nebyl přepsán.");
        jobs = data.jobs;
        for (const job of jobs) if (["queued", "running"].includes(job.status)) job.status = "interrupted";
      } catch (error) { if (error.code !== "ENOENT") throw error; }
    })();
    await initial;
  }
  async function run(job) {
    const controller = new AbortController();
    const processed = new Set();
    const config = new Configuration({ persistStorage: false, purgeOnStart: true });
    const log = new Log({ level: 0 });
    const crawler = new BasicCrawler({
      maxConcurrency: 1, maxRequestRetries: 2, requestHandlerTimeoutSecs: 90,
      maxRequestsPerMinute: 30, useSessionPool: false, log,
      requestHandler: async ({ request }) => {
        controller.signal.throwIfAborted();
        const result = await collect(request.url, controller.signal);
        controller.signal.throwIfAborted();
        const existing = job.results.findIndex((item) => item.url === result.url);
        const used = job.results.reduce((size, item, index) => size + (index === existing ? 0 : Buffer.byteLength(item.text)), 0);
        const available = Math.max(0, 1024 * 1024 - used);
        const encoded = Buffer.from(result.text);
        if (encoded.length > available) {
          result.text = new TextDecoder().decode(encoded.subarray(0, available), { stream: true });
          result.incomplete = true;
        }
        if (existing >= 0) job.results[existing] = result;
        else job.results.push(result);
        if (!processed.has(request.url)) { job.completed += 1; processed.add(request.url); }
        job.logs.push("Načteno: " + request.url);
        await save();
      },
      failedRequestHandler: async ({ request }, error) => {
        if (controller.signal.aborted) return;
        if (!processed.has(request.url)) { job.completed += 1; job.failed += 1; processed.add(request.url); }
        job.logs.push("Chyba: " + request.url + " — " + String(error.message).slice(0, 500));
        await save();
      }
    }, config);
    active = { id: job.id, controller, crawler };
    job.status = "running";
    try {
      await save();
      await crawler.run(job.urls);
      if (!controller.signal.aborted) job.status = job.failed ? "failed" : "succeeded";
    } catch (error) {
      if (!controller.signal.aborted) {
        job.status = "failed";
        job.logs.push(String(error.message).slice(0, 500));
      }
    } finally {
      if (controller.signal.aborted) job.status = "cancelled";
      await crawler.teardown().catch(() => undefined);
      job.finishedAt = new Date().toISOString();
      await save();
      active = null;
    }
  }
  async function drain() {
    if (active || closing) return;
    const job = jobs.find((item) => item.status === "queued");
    if (!job) return;
    await run(job);
    await drain();
  }
  return {
    async start(values) {
      await load();
      if (closing) throw new Error("Aplikace se ukončuje.");
      if (!Array.isArray(values) || !values.length || values.length > 10) throw new Error("Zadej 1 až 10 URL.");
      if (jobs.length >= 20) throw new Error("Nejdřív smaž některou dokončenou výzkumnou úlohu (limit 20).");
      const urls = [...new Set(values.map((value) => validateUrl(value).href))];
      const job = { id: crypto.randomUUID(), status: "queued", urls, createdAt: new Date().toISOString(), completed: 0, failed: 0, results: [], logs: [] };
      jobs.push(job);
      await save();
      if (!active) drainFlight = drain().catch((error) => { job.status = "failed"; job.logs.push(String(error.message)); });
      return job.id;
    },
    async list() {
      await load();
      return jobs.map(({ results, ...job }) => ({ ...job, resultCount: results.length })).reverse();
    },
    async read(id) {
      await load();
      const job = jobs.find((item) => item.id === id);
      if (!job) throw new Error("Výzkumná úloha neexistuje.");
      return structuredClone({ ...job, resultCount: job.results.length });
    },
    async cancel(id) {
      await load();
      const job = jobs.find((item) => item.id === id);
      if (!job) return;
      if (active?.id === id) { active.controller.abort(); active.crawler.stop(); }
      else if (job.status === "queued") job.status = "cancelled";
      await save();
    },
    async remove(id) {
      await load();
      if (jobs.some((job) => job.id === id && ["queued", "running"].includes(job.status))) throw new Error("Nejdřív úlohu zastav.");
      jobs = jobs.filter((job) => job.id !== id);
      await save();
    },
    async stop() {
      closing = true;
      if (active) { active.controller.abort(); active.crawler.stop(); }
      await drainFlight;
      await writes;
    }
  };
}
module.exports = { createResearchRuntime };
