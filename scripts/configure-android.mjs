import { readFile, writeFile } from "node:fs/promises";

const manifestPath = new URL("../android/app/src/main/AndroidManifest.xml", import.meta.url);
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
