const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const appId = "app.ethicalworld.mobile";
const packagePath = appId.replace(/\./g, path.sep);
const androidRoot = path.join(root, "android");
const manifestPath = path.join(androidRoot, "app", "src", "main", "AndroidManifest.xml");
const gradlePath = path.join(androidRoot, "app", "build.gradle");

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, "utf8");
}
function requireReplace(source, pattern, replacement, label) {
  if (!pattern.test(source)) throw new Error("Android konfigurace: nelze najít " + label + ".");
  return source.replace(pattern, replacement);
}
if (!fs.existsSync(manifestPath) || !fs.existsSync(gradlePath)) {
  throw new Error("Android projekt neexistuje. Nejprve spusť npx cap add android.");
}

const javaDir = path.join(androidRoot, "app", "src", "main", "java", packagePath);
const pluginSource = [
'package app.ethicalworld.mobile;',
'',
'import android.app.DownloadManager;',
'import android.content.Context;',
'import android.content.Intent;',
'import android.database.Cursor;',
'import android.net.Uri;',
'import android.os.Environment;',
'import android.provider.Settings;',
'import androidx.core.content.FileProvider;',
'import com.getcapacitor.JSObject;',
'import com.getcapacitor.Plugin;',
'import com.getcapacitor.PluginCall;',
'import com.getcapacitor.PluginMethod;',
'import com.getcapacitor.annotation.CapacitorPlugin;',
'import java.io.File;',
'import java.io.FileInputStream;',
'import java.security.MessageDigest;',
'import java.util.Locale;',
'',
'@CapacitorPlugin(name = "ApkUpdater")',
'public class ApkUpdaterPlugin extends Plugin {',
'    private static final String APK_NAME = "ethical-world-update.apk";',
'',
'    @PluginMethod',
'    public void downloadApk(PluginCall call) {',
'        String url = call.getString("url");',
'        if (url == null || url.length() > 2048 || !url.startsWith("https://github.com/")) {',
'            call.reject("Neplatná nebo nepovolená adresa aktualizace.");',
'            return;',
'        }',
'        try {',
'            Context context = getContext();',
'            DownloadManager manager = (DownloadManager) context.getSystemService(Context.DOWNLOAD_SERVICE);',
'            if (manager == null) { call.reject("Android DownloadManager není dostupný."); return; }',
'            File target = new File(context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), APK_NAME);',
'            if (target.exists() && !target.delete()) { call.reject("Starý instalační soubor nelze nahradit."); return; }',
'            DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url))',
'                .setTitle("Ethical World")',
'                .setDescription("Stahuji ověřenou aktualizaci aplikace")',
'                .setMimeType("application/vnd.android.package-archive")',
'                .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)',
'                .setAllowedOverMetered(true)',
'                .setAllowedOverRoaming(false)',
'                .setDestinationInExternalFilesDir(context, Environment.DIRECTORY_DOWNLOADS, APK_NAME);',
'            long id = manager.enqueue(request);',
'            JSObject result = new JSObject(); result.put("downloadId", id); call.resolve(result);',
'        } catch (Exception error) { call.reject("Aktualizaci se nepodařilo zahájit.", error); }',
'    }',
'',
'    @PluginMethod',
'    public void getDownloadStatus(PluginCall call) {',
'        long id = call.getData().optLong("downloadId", -1);',
'        if (id < 0) { call.reject("Chybí ID stahování."); return; }',
'        DownloadManager manager = (DownloadManager) getContext().getSystemService(Context.DOWNLOAD_SERVICE);',
'        if (manager == null) { call.reject("Android DownloadManager není dostupný."); return; }',
'        try (Cursor cursor = manager.query(new DownloadManager.Query().setFilterById(id))) {',
'            if (cursor == null || !cursor.moveToFirst()) { call.reject("Stahování nebylo nalezeno."); return; }',
'            int status = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS));',
'            long downloaded = cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR));',
'            long total = cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES));',
'            JSObject result = new JSObject();',
'            result.put("complete", status == DownloadManager.STATUS_SUCCESSFUL);',
'            result.put("failed", status == DownloadManager.STATUS_FAILED);',
'            result.put("progress", total > 0 ? Math.min(100, Math.round(downloaded * 100.0 / total)) : 0);',
'            if (status == DownloadManager.STATUS_FAILED) result.put("reason", cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_REASON)));',
'            call.resolve(result);',
'        } catch (Exception error) { call.reject("Stav aktualizace se nepodařilo zjistit.", error); }',
'    }',
'',
'    @PluginMethod',
'    public void installDownloaded(PluginCall call) {',
'        long id = call.getData().optLong("downloadId", -1);',
'        String expectedHash = call.getString("sha256");',
'        if (id < 0 || expectedHash == null || !expectedHash.matches("(?i)[a-f0-9]{64}")) { call.reject("Chybí ID stahování nebo platný SHA-256."); return; }',
'        try {',
'            DownloadManager manager = (DownloadManager) getContext().getSystemService(Context.DOWNLOAD_SERVICE);',
'            if (manager == null) throw new IllegalStateException("Android DownloadManager není dostupný.");',
'            String localUri;',
'            try (Cursor cursor = manager.query(new DownloadManager.Query().setFilterById(id))) {',
'                if (cursor == null || !cursor.moveToFirst() || cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS)) != DownloadManager.STATUS_SUCCESSFUL) throw new IllegalStateException("APK ještě není kompletně stažená.");',
'                localUri = cursor.getString(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_LOCAL_URI));',
'            }',
'            if (localUri == null) throw new IllegalStateException("Stažený soubor nemá lokální cestu.");',
'            File apk = new File(Uri.parse(localUri).getPath());',
'            if (!apk.isFile() || !APK_NAME.equals(apk.getName())) throw new IllegalStateException("Instalační soubor nebyl nalezen.");',
'            if (!sha256(apk).equalsIgnoreCase(expectedHash)) { apk.delete(); manager.remove(id); throw new SecurityException("SHA-256 nesouhlasí. Instalaci jsem zablokoval."); }',
'            if (android.os.Build.VERSION.SDK_INT >= 26 && !getContext().getPackageManager().canRequestPackageInstalls()) {',
'                JSObject result = new JSObject(); result.put("permissionRequired", true); call.resolve(result); return;',
'            }',
'            Uri contentUri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", apk);',
'            Intent intent = new Intent(Intent.ACTION_VIEW);',
'            intent.setDataAndType(contentUri, "application/vnd.android.package-archive");',
'            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_GRANT_READ_URI_PERMISSION);',
'            getContext().startActivity(intent);',
'            JSObject result = new JSObject(); result.put("openedInstaller", true); call.resolve(result);',
'        } catch (Exception error) { call.reject("Aktualizaci nelze nainstalovat: " + error.getMessage(), error); }',
'    }',
'',
'    @PluginMethod',
'    public void openInstallSettings(PluginCall call) {',
'        try {',
'            Intent intent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getContext().getPackageName()));',
'            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK); getContext().startActivity(intent); call.resolve();',
'        } catch (Exception error) { call.reject("Nelze otevřít nastavení instalace aplikací.", error); }',
'    }',
'',
'    private static String sha256(File file) throws Exception {',
'        MessageDigest digest = MessageDigest.getInstance("SHA-256");',
'        try (FileInputStream input = new FileInputStream(file)) {',
'            byte[] buffer = new byte[8192]; int count;',
'            while ((count = input.read(buffer)) > 0) digest.update(buffer, 0, count);',
'        }',
'        StringBuilder result = new StringBuilder();',
'        for (byte value : digest.digest()) result.append(String.format(Locale.ROOT, "%02x", value));',
'        return result.toString();',
'    }',
'}'
].join("\n") + "\n";

write(path.join(javaDir, "ApkUpdaterPlugin.java"), pluginSource);
write(path.join(javaDir, "MainActivity.java"), [
'package app.ethicalworld.mobile;',
'',
'import android.os.Bundle;',
'import com.getcapacitor.BridgeActivity;',
'',
'public class MainActivity extends BridgeActivity {',
'    @Override',
'    public void onCreate(Bundle savedInstanceState) {',
'        super.onCreate(savedInstanceState);',
'        registerPlugin(ApkUpdaterPlugin.class);',
'    }',
'}'
].join("\n") + "\n");

let manifest = fs.readFileSync(manifestPath, "utf8");
if (!manifest.includes("android.permission.REQUEST_INSTALL_PACKAGES")) {
  manifest = requireReplace(manifest, /(<manifest\b[^>]*>)/,
    '$1\n    <uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES" />',
    "kořenový manifest");
}
if (!manifest.includes('android:name="androidx.core.content.FileProvider"')) {
  manifest = requireReplace(manifest, /<\/application>/,
    '    <provider\n' +
    '            android:name="androidx.core.content.FileProvider"\n' +
    '            android:authorities="\${applicationId}.fileprovider"\n' +
    '            android:exported="false"\n' +
    '            android:grantUriPermissions="true">\n' +
    '            <meta-data android:name="android.support.FILE_PROVIDER_PATHS" android:resource="@xml/ethical_world_file_paths" />\n' +
    '        </provider>\n    </application>',
    "uzavření application");
}
fs.writeFileSync(manifestPath, manifest, "utf8");

write(path.join(androidRoot, "app", "src", "main", "res", "xml", "ethical_world_file_paths.xml"),
'<?xml version="1.0" encoding="utf-8"?>\n' +
'<paths xmlns:android="http://schemas.android.com/apk/res/android">\n' +
'    <external-files-path name="ethical_world_downloads" path="Download/" />\n' +
'</paths>\n');

let gradle = fs.readFileSync(gradlePath, "utf8");
const versionCode = Number.parseInt(process.env.ANDROID_VERSION_CODE || "1", 10);
const versionName = (process.env.ANDROID_VERSION_NAME || "0.1.2").replace(/[^0-9A-Za-z.+_-]/g, "");
if (!Number.isSafeInteger(versionCode) || versionCode < 1) throw new Error("ANDROID_VERSION_CODE musí být kladné celé číslo.");
gradle = gradle.replace(/versionCode\s+\d+/, "versionCode " + versionCode);
gradle = gradle.replace(/versionName\s+["'][^"']+["']/, 'versionName "' + versionName + '"');

if (process.env.ANDROID_KEYSTORE_PATH) {
  if (!gradle.includes("signingConfigs {")) {
    gradle = requireReplace(gradle, /buildTypes\s*\{/,
      'signingConfigs {\n' +
      '        release {\n' +
      '            storeFile file(System.getenv("ANDROID_KEYSTORE_PATH"))\n' +
      '            storePassword System.getenv("ANDROID_KEYSTORE_PASSWORD")\n' +
      '            keyAlias System.getenv("ANDROID_KEY_ALIAS")\n' +
      '            keyPassword System.getenv("ANDROID_KEY_PASSWORD")\n' +
      '        }\n' +
      '    }\n    buildTypes {',
      "blok buildTypes");
  }
  const buildTypesIndex = gradle.indexOf("buildTypes {");
  const releaseIndex = gradle.indexOf("release {", buildTypesIndex);
  if (releaseIndex < 0) throw new Error("Android Gradle: release build type nebyl nalezen.");
  const insertAt = releaseIndex + "release {".length;
  if (!gradle.slice(insertAt, insertAt + 120).includes("signingConfig signingConfigs.release")) {
    gradle = gradle.slice(0, insertAt) + "\n            signingConfig signingConfigs.release" + gradle.slice(insertAt);
  }
}
fs.writeFileSync(gradlePath, gradle, "utf8");
console.log("Android native updater nakonfigurován; versionCode=" + versionCode + ", versionName=" + versionName + ".");
