/**
 * Post-build step: rewrite the placeholders in dist/sw.js with the real list of
 * built files and a build id derived from their contents.
 *
 * Runs as part of `npm run build`. Without it the service worker ships with
 * literal `__PRECACHE__` in it and fails to parse, so the app silently loses
 * offline support rather than breaking loudly — hence the assertions below.
 */
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, posix, relative, sep } from "node:path";

const DIST = new URL("../dist/", import.meta.url).pathname;
const SW_PATH = join(DIST, "sw.js");

/** Files that are pointless or wasteful to precache. */
const EXCLUDE = new Set(["sw.js", "favicon-32.png"]);

function walk(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const files = walk(DIST)
  .map((f) => relative(DIST, f).split(sep).join(posix.sep))
  .filter((f) => !EXCLUDE.has(f))
  .sort();

const assets = files.filter((f) => f !== "index.html");
if (!assets.some((f) => f.endsWith(".js"))) {
  throw new Error("inject-sw-manifest: no JS bundle found in dist/ — did the build run?");
}
const samples = assets.filter((f) => f.startsWith("audio/salamander/"));
if (samples.length === 0) {
  throw new Error("inject-sw-manifest: no piano samples in dist/ — audio would not work offline");
}

// "./" rather than "index.html" so the cached navigation response is keyed on the
// URL the browser actually requests when the app is opened from the home screen.
const precache = ["./", ...assets.map((f) => `./${f}`)];

const buildId = createHash("sha256")
  .update(files.map((f) => `${f}:${statSync(join(DIST, f)).size}`).join("\n"))
  .digest("hex")
  .slice(0, 12);

/**
 * Whole assignment statements, not the bare tokens: the tokens also appear in
 * sw.js's own doc comment, and `String.replace` with a string pattern rewrites
 * only the first match — which would document the file list in a comment and
 * leave the real assignment holding an undefined identifier.
 */
const BUILD_ID_DECL = 'const BUILD_ID = "__BUILD_ID__";';
const PRECACHE_DECL = "const PRECACHE = __PRECACHE__;";

const source = readFileSync(SW_PATH, "utf8");
for (const decl of [BUILD_ID_DECL, PRECACHE_DECL]) {
  if (!source.includes(decl)) {
    throw new Error(`inject-sw-manifest: expected to find \`${decl}\` in dist/sw.js`);
  }
}

const injected = source
  .replace(BUILD_ID_DECL, `const BUILD_ID = ${JSON.stringify(buildId)};`)
  .replace(PRECACHE_DECL, `const PRECACHE = ${JSON.stringify(precache, null, 2)};`);

// Parse (without running) the result. A service worker that fails to evaluate
// is invisible in normal use — the app just quietly never works offline.
try {
  new Function(injected);
} catch (err) {
  throw new Error(`inject-sw-manifest: generated sw.js does not parse — ${err.message}`);
}

writeFileSync(SW_PATH, injected);

console.log(
  `sw.js: build ${buildId}, precaching ${precache.length} files (${samples.length} piano samples)`,
);
