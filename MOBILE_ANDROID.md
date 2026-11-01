# Ethical World – Android APK

![Android](https://img.shields.io/badge/platform-Android-3DDC84?logo=android&logoColor=white)
![Build](https://img.shields.io/badge/build-GitHub%20Actions-2088FF?logo=githubactions&logoColor=white)
![Capacitor](https://img.shields.io/badge/Capacitor-8.6.0-119EFF?logo=capacitor&logoColor=white)

## Cíl první mobilní verze

Android aplikace používá stávající React + TypeScript UI. Capacitor ji zabalí do nativního Android WebView; nevzniká druhá mobilní implementace editoru.

První APK je určeno pro lokální práci s poznámkami:
- vytváření a editace Markdown poznámek;
- autosave do IndexedDB;
- složky, fulltextové hledání;
- Wiki odkazy a backlinks;
- Markdown preview včetně štítků `#tag`, zvýraznění `==text==`, calloutů a Mermaid;
- knowledge graph.

Poznámky zůstávají v lokálním úložišti aplikace na telefonu. Debug APK není synchronizační služba a samo o sobě nepřenáší data mezi telefonem a PC. Před odinstalací aplikace je nutné poznámky exportovat/zálohovat.

## Vytvoření APK přes GitHub Actions

Workflow: `.github/workflows/android-apk.yml`

1. Push do `mobile/android-capacitor` spustí Android build při změně relevantních souborů.
2. Lze ho spustit také ručně přes GitHub → Actions → Android APK → Run workflow.
3. Po úspěšném běhu otevři jeho **Artifacts**.
4. Stáhni `Ethical-World-Android-debug`, rozbal ZIP a nainstaluj `app-debug.apk`.

APK je debug build podepsaný debug klíčem. Není určený pro publikaci do Google Play.

## Lokální sestavení

Po instalaci Android Studio, Android SDK a JDK 21:

```bash
npm ci
npm install --no-save --package-lock=false @capacitor/core@8.6.0 @capacitor/cli@8.6.0 @capacitor/android@8.6.0
node scripts/generate-android-icons.cjs --web-only
npm run verify
npm run build
npx cap add android
node scripts/generate-android-icons.cjs --android-only
npx cap sync android
cd android
./gradlew assembleDebug
```

Výstup:
`android/app/build/outputs/apk/debug/app-debug.apk`

## Omezení první verze

- AI gateway a FastAPI backend desktopové aplikace nejsou automaticky součástí APK. Mobilní poznámkový vault má fungovat lokálně; mobilní připojení k Máše vyžaduje samostatné bezpečné řešení.
- IndexedDB je úložiště privátní pro instalaci/aplikační origin. Odinstalace aplikace nebo vymazání jejích dat může odstranit lokální poznámky.
- Před ostrým používáním ověřit import/export a zálohu na reálném Android zařízení.
- Build workflow generuje Android projekt během CI; do repozitáře se nepřidává samostatná větev ani druhá kopie UI.

## Technické verze

- Node.js 24
- JDK 21
- Capacitor 8.6.0
- Android debug APK

## Ikona aplikace

Launcher ikona Androidu se generuje z `public/ethical-world-mark.svg`. Skript vytváří PWA PNG ikony i legacy a adaptive Android ikony pro běžné hustoty displeje. V CI se webové ikony generují před buildem a nativní ikony po vytvoření Android projektu.
