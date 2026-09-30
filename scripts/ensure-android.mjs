import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const androidDir = fileURLToPath(new URL("../android", import.meta.url));
let exists = true;
try {
  await access(androidDir, constants.F_OK);
} catch {
  exists = false;
}

if (exists) {
  console.log("Android platform already exists; keeping the existing native project.");
} else {
  const npx = process.platform === "win32" ? "npx.cmd" : "npx";
  execFileSync(npx, ["cap", "add", "android"], { stdio: "inherit" });
}
