import { useCallback, useEffect, useState } from "react";
import {
  APP_VERSION,
  getNativeApkUpdater,
  isNewerVersion,
  UPDATE_MANIFEST_URL,
  validateUpdateManifest,
  type AndroidUpdateManifest
} from "../lib/androidUpdater";

type UpdateState = "checking" | "idle" | "available" | "downloading" | "ready" | "permission" | "error";

function formatSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return "";
  return (bytes / 1024 / 1024).toFixed(1).replace(".", ",") + " MB";
}

export function UpdateBanner() {
  const [manifest, setManifest] = useState<AndroidUpdateManifest | null>(null);
  const [state, setState] = useState<UpdateState>("checking");
  const [message, setMessage] = useState("");
  const [progress, setProgress] = useState(0);
  const [downloadId, setDownloadId] = useState<number | null>(null);

  useEffect(() => {
    if (window.Capacitor?.getPlatform?.() !== "android") {
      setState("idle");
      return;
    }

    const controller = new AbortController();
    const check = async () => {
      try {
        const response = await fetch(UPDATE_MANIFEST_URL, {
          cache: "no-store",
          signal: controller.signal,
          headers: { Accept: "application/json" }
        });
        if (!response.ok) throw new Error("Kontrola aktualizací není dostupná.");
        const parsed = validateUpdateManifest(await response.json());
        if (!parsed) throw new Error("Manifest aktualizace nemá platný formát.");
        if (isNewerVersion(parsed.version, APP_VERSION)) {
          setManifest(parsed);
          setState("available");
        } else {
          setState("idle");
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setState("idle");
          console.info("Ethical World update check skipped:", error);
        }
      }
    };

    void check();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (state !== "downloading" || downloadId === null) return;
    const updater = getNativeApkUpdater();
    if (!updater) {
      setState("error");
      setMessage("Nativní instalační modul není dostupný. Aktualizaci nelze bezpečně nainstalovat.");
      return;
    }

    let active = true;
    const poll = async () => {
      try {
        const result = await updater.getDownloadStatus({ downloadId });
        if (!active) return;
        setProgress(Math.max(0, Math.min(100, result.progress || 0)));
        if (result.failed) {
          setState("error");
          setMessage("Stažení aktualizace selhalo (kód " + (result.reason ?? "neznámý") + "). Zkus to prosím znovu.");
        } else if (result.complete) {
          setProgress(100);
          setState("ready");
          setMessage("Aktualizace je stažená a připravená k instalaci.");
        }
      } catch (error) {
        if (!active) return;
        setState("error");
        setMessage(error instanceof Error ? error.message : "Nepodařilo se ověřit stav stahování.");
      }
    };

    void poll();
    const timer = window.setInterval(() => void poll(), 1200);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [downloadId, state]);

  const startDownload = useCallback(async () => {
    if (!manifest) return;
    const updater = getNativeApkUpdater();
    if (!updater) {
      setState("error");
      setMessage("Aktualizace je dostupná pouze v nainstalované Android aplikaci.");
      return;
    }
    setState("downloading");
    setProgress(0);
    setMessage("Připravuji bezpečné stažení…");
    try {
      const result = await updater.downloadApk({ url: manifest.apkUrl });
      setDownloadId(result.downloadId);
      setMessage("Stahuji aktualizaci…");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Stažení aktualizace se nepodařilo spustit.");
    }
  }, [manifest]);

  const install = useCallback(async () => {
    if (!manifest || downloadId === null) return;
    const updater = getNativeApkUpdater();
    if (!updater) return;
    try {
      const result = await updater.installDownloaded({ downloadId, sha256: manifest.sha256 });
      if (result.permissionRequired) {
        setState("permission");
        setMessage("Povol instalaci aplikací pro Ethical World a vrať se sem.");
      } else if (result.openedInstaller) {
        setMessage("Android otevřel instalační potvrzení. Dokonči aktualizaci v systémovém dialogu.");
      }
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Instalace aktualizace selhala.");
    }
  }, [downloadId, manifest]);

  const openPermissionSettings = useCallback(async () => {
    const updater = getNativeApkUpdater();
    if (!updater) return;
    try {
      await updater.openInstallSettings();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nastavení oprávnění nelze otevřít.");
    }
  }, []);

  if (!manifest || state === "checking" || state === "idle") return null;

  return (
    <section className="mobile-update-banner" aria-live="polite">
      <div className="mobile-update-mark" aria-hidden="true">↻</div>
      <div className="mobile-update-content">
        <div className="mobile-update-heading">
          <strong>Nová verze Ethical World</strong>
          <span>v{manifest.version}{manifest.sizeBytes ? " · " + formatSize(manifest.sizeBytes) : ""}</span>
        </div>
        {state === "available" && (
          <ul>{manifest.releaseNotes.map((note, index) => <li key={index}>{note}</li>)}</ul>
        )}
        {state === "downloading" && (
          <div className="mobile-update-progress" aria-label={"Staženo " + progress + " procent"}>
            <span style={{ width: progress + "%" }} />
          </div>
        )}
        {message && <p>{message}</p>}
        <div className="mobile-update-actions">
          {state === "available" && <button type="button" onClick={() => void startDownload()}>Stáhnout aktualizaci</button>}
          {state === "ready" && <button type="button" onClick={() => void install()}>Instalovat aktualizaci</button>}
          {state === "permission" && (
            <>
              <button type="button" onClick={() => void openPermissionSettings()}>Povolit instalaci</button>
              <button type="button" className="secondary" onClick={() => void install()}>Pokračovat</button>
            </>
          )}
          {state === "error" && <button type="button" className="secondary" onClick={() => { setState("available"); setMessage(""); setDownloadId(null); }}>Zkusit znovu</button>}
        </div>
      </div>
    </section>
  );
}

export default UpdateBanner;
