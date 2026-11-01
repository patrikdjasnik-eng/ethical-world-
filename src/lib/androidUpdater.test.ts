import { describe, expect, it } from "vitest";
import { isNewerVersion, validateUpdateManifest } from "./androidUpdater";

describe("Android update manifest", () => {
  it("compares semantic app versions", () => {
    expect(isNewerVersion("0.1.3", "0.1.2")).toBe(true);
    expect(isNewerVersion("0.2.0", "0.1.9")).toBe(true);
    expect(isNewerVersion("0.1.2", "0.1.2")).toBe(false);
    expect(isNewerVersion("0.1.1", "0.1.2")).toBe(false);
    expect(isNewerVersion("latest", "0.1.2")).toBe(false);
  });

  it("accepts only a well-formed manifest pointing to this repository's release assets", () => {
    const valid = {
      version: "0.1.3",
      versionCode: 42,
      apkUrl: "https://github.com/patrikdjasnik-eng/ethical-world-/releases/download/android-v0.1.3-42/ethical-world.apk",
      sha256: "a".repeat(64),
      releaseNotes: ["Opravy mobilního ovládání."],
      sizeBytes: 123456
    };
    expect(validateUpdateManifest(valid)).toEqual(valid);
  });

  it("rejects external APK URLs and malformed checksums", () => {
    const base = {
      version: "0.1.3",
      versionCode: 42,
      apkUrl: "https://example.com/ethical-world.apk",
      sha256: "not-a-hash",
      releaseNotes: []
    };
    expect(validateUpdateManifest(base)).toBeNull();
  });

  it("rejects untrusted release notes and invalid version codes", () => {
    const base = {
      version: "0.1.3",
      versionCode: 1.5,
      apkUrl: "https://github.com/patrikdjasnik-eng/ethical-world-/releases/download/test/ethical-world.apk",
      sha256: "b".repeat(64),
      releaseNotes: [42]
    };
    expect(validateUpdateManifest(base)).toBeNull();
  });
});
