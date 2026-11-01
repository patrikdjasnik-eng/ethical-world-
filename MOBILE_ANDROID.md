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

## Automatické aktualizace Android APK

Aplikace obsahuje kontrolu verze při spuštění, stažení přes Android DownloadManager, ověření SHA-256 a předání APK systémovému instalátoru. Android vždy vyžaduje potvrzení instalace uživatelem.

### Jednorázové nastavení release podpisu

Debug APK z běžného CI není dlouhodobý distribuční podpis. Pro aktualizace přes instalátor je nutný stabilní release keystore, který se nikdy nesmí commitovat do repozitáře.

Na Windows po instalaci JDK 21 a GitHub CLI a přihlášení přes gh auth login spusť z kořene projektu:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/setup-android-signing.ps1
```

Skript vytvoří keystore mimo projekt a uloží čtyři GitHub Actions secrets. Soubor keystore bezpečně zálohuj; bez něj už nepůjde podepisovat další kompatibilní aktualizace.

### Vydání aktualizace

Workflow .github/workflows/android-release.yml připravuje podepsané APK, SHA-256 a manifest android-update.json. Po úspěšném releasu aplikace zjistí novou verzi sama. Před dalším vydáním zvyš version v package.json i package-lock.json (např. 0.1.2 → 0.1.3).

**Migrace z aktuální debug APK:** první instalace s novým release podpisem může vyžadovat jednorázovou přeinstalaci. Android nepovolí aktualizaci přes jiný podpis. Před tímto přechodem exportuj poznámky a ověř, že záloha jde znovu importovat; odinstalace může vymazat lokální IndexedDB.

### Lokální vývoj s Capacitor updaterem

Po `npm ci` doinstaluj stejnou verzi Capacitor Core, kterou používá Android build:

```powershell
npm install --no-save --package-lock=false @capacitor/core@8.6.0
```

Pak spusť obvyklé `npm run verify` a Android build. CI tuto závislost instaluje automaticky.
