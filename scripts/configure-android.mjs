import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const manifestUrl = new URL("../android/app/src/main/AndroidManifest.xml", import.meta.url);
const manifestPath = fileURLToPath(manifestUrl);
const manifest = await readFile(manifestPath, "utf8");

const meta = `        <meta-data
            android:name="com.google.android.gms.ads.APPLICATION_ID"
            android:value="ca-app-pub-3940256099942544~3347511713" />`;

let next = manifest;
if (!manifest.includes("com.google.android.gms.ads.APPLICATION_ID")) {
  next = manifest.replace("<application", `<application`);
  const appOpen = next.indexOf("<application");
  const appClose = next.indexOf(">", appOpen);
  next = next.slice(0, appClose + 1) + "\n" + meta + next.slice(appClose + 1);
}

await writeFile(manifestPath, next);
console.log("Android configured with Google's sample AdMob app ID for testing.");

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
