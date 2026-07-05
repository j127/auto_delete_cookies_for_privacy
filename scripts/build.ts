/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2017-2022 Kenny Do and CAD Team; fork changes (c) 2026 j127.
 * Licensed under MIT (see LICENSE).
 */

/**
 * Extension build script (replaces webpack). Run with:
 *   bun run scripts/build.ts          one-shot build
 *   bun run scripts/build.ts --watch  rebuild on changes under src/
 *
 * Emits three ESM entry bundles (plus shared chunks) into extension/bundles/
 * and copies the bootstrap/jquery vendor files into extension/global_files/
 * (those vendor copies disappear with the Tailwind rework). The MV3 service
 * worker runs the background bundle with "type": "module", and both HTML
 * pages load their entry with <script type="module">.
 */

// Bare specifiers (not node:-prefixed) and older fs APIs (copyFileSync,
// rmdirSync) because the locked @types/node is too old for the node: aliases
// and for cpSync/rmSync; Bun implements all of these.
import { copyFileSync, existsSync, mkdirSync, rmdirSync, watch } from "fs";
import { join } from "path";

const root = join(import.meta.dir, "..");
const srcDir = join(root, "src");
const outDir = join(root, "extension", "bundles");
const vendorDir = join(root, "extension", "global_files");

const BANNER = `/*!
 * Copyright (c) 2017-2022 Kenny Do and CAD Team (https://github.com/Cookie-AutoDelete/Cookie-AutoDelete/graphs/contributors)
 * Fork: Auto-Delete Cookies for Privacy, Copyright (c) 2026 j127 (https://github.com/j127/autodelete_cookies_for_privacy)
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

// Vendor page scripts still referenced by the two HTML pages.
const VENDOR_FILES = [
  "bootstrap/dist/css/bootstrap.min.css",
  "bootstrap/dist/css/bootstrap.min.css.map",
  "bootstrap/dist/js/bootstrap.bundle.min.js",
  "bootstrap/dist/js/bootstrap.bundle.min.js.map",
  "jquery/dist/jquery.slim.min.js",
  "jquery/dist/jquery.slim.min.map",
];

function copyVendorFiles(): void {
  // The vendor copies themselves are gitignored, so on a fresh clone (CI)
  // the directory doesn't exist at all - git can't track an empty dir.
  mkdirSync(vendorDir, { recursive: true });
  for (const rel of VENDOR_FILES) {
    const from = join(root, "node_modules", rel);
    if (!existsSync(from)) {
      console.warn(`vendor file missing, skipped: ${rel}`);
      continue;
    }
    const base = rel.split("/").pop() as string;
    copyFileSync(from, join(vendorDir, base));
  }
}

async function buildOnce(): Promise<boolean> {
  const started = Date.now();
  if (existsSync(outDir)) rmdirSync(outDir, { recursive: true });
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
  copyVendorFiles();
  const files = result.outputs
    .map((o) => o.path.replace(`${root}/`, ""))
    .filter((p) => !p.endsWith(".map"));
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
