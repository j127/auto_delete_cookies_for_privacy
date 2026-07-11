/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2017-2022 Kenny Do and CAD Team; fork changes (c) 2026 j127.
 * Licensed under MIT (see LICENSE).
 */

/**
 * Extension build script (replaces webpack). Run with:
 *   bun run scripts/build.ts                    one-shot Chrome build
 *   bun run scripts/build.ts --watch            rebuild on changes under src/
 *   bun run scripts/build.ts --target firefox   assemble builds/firefox/
 *
 * Emits three ESM entry bundles (plus shared chunks) and compiles the
 * Tailwind 4 stylesheet (src/ui/styles.css) into <bundles>/ui.css via
 * @tailwindcss/cli. The MV3 background runs the background bundle with
 * "type": "module" (service worker on Chrome, event page on Firefox), and
 * both HTML pages load their entry with <script type="module"> plus the
 * compiled stylesheet. The bootstrap/jquery vendor copies are gone since #42.
 *
 * Targets: the default `chrome` target writes bundles into
 * extension/bundles/ — extension/ itself IS the Chrome artifact, unchanged
 * by the Firefox work. The `firefox` target assembles a complete loadable
 * artifact in builds/firefox/ (gitignored): fresh bundles, every static
 * asset copied from extension/, and a manifest generated from
 * extension/manifest.json by scripts/firefox_manifest.ts so shared fields
 * have a single source of truth.
 */

// Bare specifiers (not node:-prefixed) and older fs APIs (rmdirSync) because
// the locked @types/node is too old for the node: aliases and for
// cpSync/rmSync; Bun implements all of these.
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  watch,
  writeFileSync,
} from "fs";
import { join } from "path";

import { buildFirefoxManifest, serializeManifest } from "./firefox_manifest";

const args = process.argv.slice(2);
const targetFlagIndex = args.indexOf("--target");
const target = targetFlagIndex === -1 ? "chrome" : args[targetFlagIndex + 1];
if (target !== "chrome" && target !== "firefox") {
  console.error(
    `unknown --target "${target ?? ""}" (expected "chrome" or "firefox")`
  );
  process.exit(1);
}

const root = join(import.meta.dir, "..");
const srcDir = join(root, "src");
const extensionDir = join(root, "extension");
// For firefox the whole artifact directory is generated; for chrome only
// bundles/ inside the committed extension/ directory is.
const artifactDir =
  target === "firefox" ? join(root, "builds", "firefox") : extensionDir;
const outDir = join(artifactDir, "bundles");

const BANNER = `/*!
 * Copyright (c) 2017-2022 Kenny Do and CAD Team (https://github.com/Cookie-AutoDelete/Cookie-AutoDelete/graphs/contributors)
 * Fork: Auto-Delete Cookies for Privacy, Copyright (c) 2026 j127 (https://github.com/j127/auto_delete_cookies_for_privacy)
 * Licensed under MIT (https://github.com/Cookie-AutoDelete/Cookie-AutoDelete/blob/3.X.X-Branch/LICENSE)
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */`;

/**
 * Compiles src/ui/styles.css (Tailwind 4 + DaisyUI) into
 * extension/bundles/ui.css. Spawns the CLI binary directly from
 * node_modules/.bin so no global install is needed; Bun runs it fine.
 * Unminified, matching the JS bundles (reviewable output).
 */
async function buildTailwind(): Promise<boolean> {
  const proc = Bun.spawn(
    [
      join(root, "node_modules", ".bin", "tailwindcss"),
      "-i",
      join(srcDir, "ui", "styles.css"),
      "-o",
      join(outDir, "ui.css"),
    ],
    { cwd: root, stdout: "ignore", stderr: "inherit" }
  );
  return (await proc.exited) === 0;
}

/**
 * Recursive copy via the old fs APIs (see the import note above; the locked
 * @types/node predates cpSync). Dotfiles (.DS_Store and friends) are
 * skipped so they never land in a store-bound artifact.
 */
function copyDir(from: string, to: string): void {
  mkdirSync(to, { recursive: true });
  for (const entry of readdirSync(from)) {
    if (entry.startsWith(".")) continue;
    const src = join(from, entry);
    const dest = join(to, entry);
    if (statSync(src).isDirectory()) copyDir(src, dest);
    else copyFileSync(src, dest);
  }
}

/**
 * Assembles the Firefox artifact around the freshly built bundles: every
 * static asset from extension/ (only manifest.json — regenerated — and
 * bundles/ — built above — are excluded, so a newly added asset is picked
 * up automatically) plus the generated Firefox manifest.
 */
function assembleFirefoxArtifact(): string[] {
  const copied: string[] = [];
  const generated = new Set(["manifest.json", "bundles"]);
  for (const entry of readdirSync(extensionDir)) {
    if (generated.has(entry) || entry.startsWith(".")) continue;
    const src = join(extensionDir, entry);
    const dest = join(artifactDir, entry);
    if (statSync(src).isDirectory()) copyDir(src, dest);
    else copyFileSync(src, dest);
    copied.push(entry);
  }
  const chromeManifest = JSON.parse(
    readFileSync(join(extensionDir, "manifest.json"), "utf8")
  );
  writeFileSync(
    join(artifactDir, "manifest.json"),
    serializeManifest(buildFirefoxManifest(chromeManifest))
  );
  return copied;
}

async function buildOnce(): Promise<boolean> {
  const started = Date.now();
  // chrome wipes only the generated bundles/ inside the committed
  // extension/ directory; firefox regenerates its artifact dir wholesale.
  const wipeDir = target === "firefox" ? artifactDir : outDir;
  if (existsSync(wipeDir)) rmSync(wipeDir, { recursive: true });
  const result = await Bun.build({
    entrypoints: [
      join(srcDir, "background.ts"),
      join(srcDir, "ui", "popup", "index.tsx"),
      join(srcDir, "ui", "settings", "index.tsx"),
    ],
    outdir: outDir,
    root: srcDir,
    format: "esm",
    splitting: true,
    sourcemap: "linked",
    // Unminified on purpose: trivial sizes, and reviewable bundles make
    // Chrome Web Store review less painful.
    minify: false,
    banner: BANNER,
  });
  if (!result.success) {
    for (const log of result.logs) console.error(log);
    return false;
  }
  if (!(await buildTailwind())) return false;
  const files = result.outputs
    .map((o) => o.path.replace(`${root}/`, ""))
    .filter((p) => !p.endsWith(".map"))
    .concat(join(outDir, "ui.css").replace(`${root}/`, ""));
  if (target === "firefox") {
    const copied = assembleFirefoxArtifact();
    files.push(join(artifactDir, "manifest.json").replace(`${root}/`, ""));
    console.log(`copied static assets: ${copied.join(", ")}`);
  }
  console.log(
    `built ${files.length} files in ${Date.now() - started}ms\n  ${files.join("\n  ")}`
  );
  return true;
}

const ok = await buildOnce();

if (process.argv.includes("--watch")) {
  console.log("watching src/ for changes...");
  let pending: ReturnType<typeof setTimeout> | undefined;
  watch(srcDir, { recursive: true }, () => {
    if (pending) clearTimeout(pending);
    pending = setTimeout(() => {
      void buildOnce();
    }, 150);
  });
} else if (!ok) {
  process.exit(1);
}
