import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { build } from "esbuild";

const dist = new URL("../dist/", import.meta.url);
const root = new URL("../", import.meta.url);

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

const assets = [
  "app.css",
  "app.js",
  "firebase-auth.js",
  "firebase-config.js",
  "icon-192.png",
  "icon-512.png",
  "icon.svg",
  "logo.svg",
  "mark.svg",
  "manifest.webmanifest",
  "sw.js",
  "locales"
];

for (const asset of assets) {
  await cp(new URL(asset, root), new URL(asset, dist), { recursive: true });
}

let html = await readFile(new URL("index.html", root), "utf8");
html = html.replace(
  "</body>",
  '  <script type="module" src="./mobile.js"></script>\n</body>'
);
await writeFile(new URL("index.html", dist), html);

await build({
  entryPoints: [new URL("mobile-src.js", root).pathname],
  outfile: new URL("mobile.js", dist).pathname,
  bundle: true,
  format: "esm",
  platform: "browser",
  target: ["es2022"],
  minify: true
});

console.log("Mobile web bundle built in dist/");
