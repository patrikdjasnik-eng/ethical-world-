import packageInfo from "../../package.json";

export interface AndroidUpdateManifest {
  version: string;
  versionCode: number;
  apkUrl: string;
  sha256: string;
  releaseNotes: string[];
  sizeBytes?: number;
}

interface NativeDownloadStatus {
  complete: boolean;
  failed: boolean;
  progress: number;
  reason?: number;
}

interface NativeInstallResult {
  permissionRequired?: boolean;
  openedInstaller?: boolean;
}

export interface NativeApkUpdater {
  downloadApk(options: { url: string }): Promise<{ downloadId: number }>;
  getDownloadStatus(options: { downloadId: number }): Promise<NativeDownloadStatus>;
  installDownloaded(options: { downloadId: number; sha256: string }): Promise<NativeInstallResult>;
  openInstallSettings(): Promise<void>;
}

declare global {
  interface Window {
    Capacitor?: {
      getPlatform?: () => string;
      Plugins?: {
        ApkUpdater?: NativeApkUpdater;
      };
      registerPlugin?: (pluginName: string) => NativeApkUpdater;
    };
  }
}

export const APP_VERSION = packageInfo.version;
export const UPDATE_MANIFEST_URL =
  "https://raw.githubusercontent.com/patrikdjasnik-eng/ethical-world-/mobile/android-capacitor/android-update.json";

export function isNewerVersion(candidate: string, current: string): boolean {
  const parse = (value: string) => value.split(".").map((part) => Number.parseInt(part, 10));
  const next = parse(candidate);
  const installed = parse(current);
  if (next.length !== 3 || installed.length !== 3 || [...next, ...installed].some((part) => !Number.isFinite(part))) return false;
  for (let index = 0; index < 3; index += 1) {
    if (next[index] > installed[index]) return true;
    if (next[index] < installed[index]) return false;
  }
  return false;
}

export function validateUpdateManifest(value: unknown): AndroidUpdateManifest | null {
  if (!value || typeof value !== "object") return null;
  const manifest = value as Record<string, unknown>;
  if (
    typeof manifest.version !== "string" ||
    !/^\d+\.\d+\.\d+$/.test(manifest.version) ||
    typeof manifest.versionCode !== "number" ||
    !Number.isSafeInteger(manifest.versionCode) ||
    typeof manifest.apkUrl !== "string" ||
    !manifest.apkUrl.startsWith("https://github.com/patrikdjasnik-eng/ethical-world-/releases/download/") ||
    typeof manifest.sha256 !== "string" ||
    !/^[a-f0-9]{64}$/i.test(manifest.sha256) ||
    !Array.isArray(manifest.releaseNotes) ||
    !manifest.releaseNotes.every((item) => typeof item === "string" && item.length <= 240)
  ) return null;

  return {
    version: manifest.version,
    versionCode: manifest.versionCode,
    apkUrl: manifest.apkUrl,
    sha256: manifest.sha256,
    releaseNotes: manifest.releaseNotes.slice(0, 8) as string[],
    sizeBytes: typeof manifest.sizeBytes === "number" && Number.isFinite(manifest.sizeBytes) ? manifest.sizeBytes : undefined
  };
}

let registeredUpdater: NativeApkUpdater | null = null;

export function getNativeApkUpdater(): NativeApkUpdater | null {
  const capacitor = window.Capacitor;
  if (capacitor?.getPlatform?.() !== "android") return null;
  if (registeredUpdater) return registeredUpdater;
  registeredUpdater = capacitor.Plugins?.ApkUpdater ?? capacitor.registerPlugin?.("ApkUpdater") ?? null;
  return registeredUpdater;
}
