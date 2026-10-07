import { memo, useCallback, useEffect, useState } from "react";
import { markdownFilesToNotes } from "../lib/markdownConnector";
import type { Note } from "../types";
import type { ResearchJob } from "../types/research";

const statusLabels: Record<ResearchJob["status"], string> = {
  queued: "Čeká", running: "Běží", succeeded: "Hotovo", failed: "Dokončeno s chybou",
  cancelled: "Zrušeno", interrupted: "Přerušeno při ukončení aplikace"
};

export const ResearchPanel = memo(function ResearchPanel({ notes, onImportNotes }: {
  notes: Note[];
  onImportNotes: (notes: Note[], expectedNotes?: Note[]) => Promise<void>;
}) {
  const desktop = window.ethicalDesktop;
  const [urls, setUrls] = useState("");
  const [jobs, setJobs] = useState<ResearchJob[]>([]);
  const [selected, setSelected] = useState<ResearchJob | null>(null);
  const [message, setMessage] = useState("Zadej až 10 veřejných HTTPS adres, každou na nový řádek.");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!desktop?.researchList) return;
    let cancelled = false;
    let polling = false;
    const poll = async () => {
      if (polling) return;
      polling = true;
      try {
        const result = await desktop.researchList!();
        if (!cancelled) setJobs(result);
      } catch (error) { if (!cancelled) setMessage(String(error)); }
      finally { polling = false; }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 1500);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [desktop]);

  const perform = useCallback(async (operation: () => Promise<void>) => {
    setBusy(true);
    try { await operation(); }
    catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  }, []);

  const start = useCallback(() => perform(async () => {
    if (!desktop?.researchStart || !desktop.researchList) return;
    const values = urls.split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
    await desktop.researchStart(values);
    setJobs(await desktop.researchList());
    setMessage("Úloha zařazena. Výsledky zůstanou lokálně, dokud je neimportuješ.");
  }), [desktop, perform, urls]);

  const importResults = useCallback(() => perform(async () => {
    if (!selected?.results?.length) return;
    const files = selected.results.map((result, index) => ({
      relativePath: "Research/" + (index + 1) + "-" + result.title.replace(/[\\/:*?"<>|]/g, " ") + ".md",
      content: "# " + result.title.replace(/[\r\n]/g, " ") + "\n\nZdroj: " + result.url + "\nNačteno: " + result.fetchedAt + "\n\n" + result.text,
      incomplete: result.incomplete
    }));
    const imported = markdownFilesToNotes(files, "research:" + selected.id, notes, "web-research");
    await onImportNotes(imported, notes);
    setMessage("Importováno " + imported.length + " výzkumných poznámek se zdrojovými odkazy.");
  }), [notes, onImportNotes, perform, selected]);

  return <section className="connector-card connector-card-ready">
    <div className="connector-card-head"><div className="connector-icon">R</div><div><strong>Web Research</strong><span>Lokální výzkumné úlohy</span></div></div>
    <p>Stáhne text ze zadaných stránek, respektuje robots.txt a uloží výsledky k náhledu. Stránky vyžadující JavaScript nebo přihlášení mohou vrátit neúplný obsah.</p>
    <p>Powered by <a href="https://github.com/apify/crawlee" target="_blank" rel="noopener noreferrer">Crawlee by Apify</a> · Apache 2.0. Děkujeme Apify za open source.</p>
    {desktop?.researchStart ? <>
      <label>Adresy pro výzkum<textarea aria-label="Adresy pro výzkum" value={urls} onChange={(event) => setUrls(event.target.value)} rows={4} placeholder="https://example.org/article" /></label>
      <button type="button" disabled={busy || !urls.trim()} onClick={() => void start()}>Spustit výzkum</button>
      <ul className="research-jobs">{jobs.map((job) => <li key={job.id}>
        <strong>{statusLabels[job.status]} · {job.completed}/{job.urls.length}</strong>
        <div className="connector-actions">
          <button type="button" disabled={busy} onClick={() => void perform(async () => { setSelected(await desktop.researchRead!(job.id)); })}>Výsledky ({job.resultCount})</button>
          {["queued", "running"].includes(job.status)
            ? <button type="button" disabled={busy} onClick={() => void perform(async () => { await desktop.researchCancel!(job.id); setJobs(await desktop.researchList!()); })}>Zastavit</button>
            : <><button type="button" disabled={busy} onClick={() => void perform(async () => { await desktop.researchStart!(job.urls); setJobs(await desktop.researchList!()); })}>Spustit znovu</button><button type="button" disabled={busy} onClick={() => void perform(async () => { await desktop.researchRemove!(job.id); if (selected?.id === job.id) setSelected(null); setJobs(await desktop.researchList!()); })}>Smazat úlohu</button></>}
        </div>
      </li>)}</ul>
      {selected && <div className="research-preview">
        <h3>Výsledky úlohy</h3>
        {selected.results?.map((result) => <details key={result.url}><summary>{result.title}{result.incomplete ? " · zkráceno" : ""}</summary><a href={result.url} target="_blank" rel="noopener noreferrer">{result.url}</a><pre>{result.text}</pre></details>)}
        <details><summary>Průběh a chyby</summary><pre>{selected.logs.join("\n") || "Zatím žádné záznamy."}</pre></details>
        <button type="button" disabled={busy || !selected.results?.length || ["queued", "running"].includes(selected.status)} onClick={() => void importResults()}>Importovat výsledky do vaultu</button>
      </div>}
    </> : <p>Web Research je dostupný v desktopové aplikaci.</p>}
    <small role="status">{message}</small>
  </section>;
});
