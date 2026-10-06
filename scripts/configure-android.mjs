import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const manifestUrl = new URL("../android/app/src/main/AndroidManifest.xml", import.meta.url);
const manifestPath = fileURLToPath(manifestUrl);
const manifest = await readFile(manifestPath, "utf8");

const meta = `        <meta-data
            android:name="com.google.android.gms.ads.APPLICATION_ID"
            android:value="ca-app-pub-0222399393353451~4434972903" />`;

let next = manifest;
const appIdMetaPattern = /(android:name="com\.google\.android\.gms\.ads\.APPLICATION_ID"[\s\S]*?android:value=")[^"]+(")/;
if (appIdMetaPattern.test(next)) {
  next = next.replace(appIdMetaPattern, `$1ca-app-pub-0222399393353451~4434972903$2`);
} else {
  const appOpen = next.indexOf("<application");
  const appClose = next.indexOf(">", appOpen);
  next = next.slice(0, appClose + 1) + "\n" + meta + next.slice(appClose + 1);
}

await writeFile(manifestPath, next);
console.log("Android configured with the Powerlifting Performance Hub AdMob app ID.");

const buildGradleUrl = new URL("../android/app/build.gradle", import.meta.url);
const buildGradlePath = fileURLToPath(buildGradleUrl);
let buildGradle = await readFile(buildGradlePath, "utf8");
if (buildGradle.includes("getDefaultProguardFile('proguard-android.txt')")) {
  buildGradle = buildGradle.replace(
    "getDefaultProguardFile('proguard-android.txt')",
    "getDefaultProguardFile('proguard-android-optimize.txt')"
  );
  await writeFile(buildGradlePath, buildGradle);
  console.log("Updated Android release ProGuard template for current AGP/R8.");
}


const admobGradleUrl = new URL("../node_modules/@capacitor-community/admob/android/build.gradle", import.meta.url);
const admobGradlePath = fileURLToPath(admobGradleUrl);
try {
  let admobGradle = await readFile(admobGradlePath, "utf8");
  if (admobGradle.includes("getDefaultProguardFile('proguard-android.txt')")) {
    admobGradle = admobGradle.replace(
      "getDefaultProguardFile('proguard-android.txt')",
      "getDefaultProguardFile('proguard-android-optimize.txt')"
    );
    await writeFile(admobGradlePath, admobGradle);
    console.log("Updated AdMob plugin ProGuard template for current AGP/R8.");
  }
} catch (error) {
  console.warn("AdMob plugin Gradle file was not found; skipping plugin patch.");
}

// Reproducible release metadata; keep the existing package identity.
const { cp, mkdir } = await import('node:fs/promises');
const release = JSON.parse(await readFile(new URL('../android-release.json',import.meta.url),'utf8'));
buildGradle = await readFile(buildGradlePath,'utf8');
buildGradle = buildGradle.replace(/versionCode \d+/,`versionCode ${release.versionCode}`).replace(/versionName "[^"]+"/,`versionName "${release.versionName}"`);
if (!buildGradle.includes('hub-release.gradle')) buildGradle += "\napply from: 'hub-release.gradle'\n";
await writeFile(buildGradlePath,buildGradle);
let variables=await readFile(new URL('../android/variables.gradle',import.meta.url),'utf8');
variables=variables.replace(/compileSdkVersion = \d+/,`compileSdkVersion = ${release.targetSdk}`).replace(/targetSdkVersion = \d+/,`targetSdkVersion = ${release.targetSdk}`);
await writeFile(new URL('../android/variables.gradle',import.meta.url),variables);
let configuredManifest=await readFile(manifestPath,'utf8');
configuredManifest=configuredManifest.replace('android:allowBackup="true"','android:allowBackup="false"').replace(/android:icon="[^"]+"/,'android:icon="@drawable/hub_icon"').replace(/android:roundIcon="[^"]+"/,'android:roundIcon="@drawable/hub_icon"');
await writeFile(manifestPath,configuredManifest);
await cp(new URL('../icon-512.png',import.meta.url),new URL('../android/app/src/main/res/drawable/hub_icon.png',import.meta.url));
await cp(new URL('../native/hub-release.gradle',import.meta.url),new URL('../android/app/hub-release.gradle',import.meta.url));
await mkdir(new URL('../android/app/src/androidTest/java/com/powerliftingcalculator/performancehub/',import.meta.url),{recursive:true});
await cp(new URL('../native/HubSmokeTest.java',import.meta.url),new URL('../android/app/src/androidTest/java/com/powerliftingcalculator/performancehub/HubSmokeTest.java',import.meta.url));
console.log(`Android ${release.versionName} (${release.versionCode}), target API ${release.targetSdk}; release signing comes only from your private environment.`);
