# Contributing

This page covers the toolchain, the branch rules, and what a change needs before it merges.

## Toolchain

You need three tools installed globally:

- [Bun](https://bun.sh) -- this is the package manager and bundler (there is no npm workflow here; use `bun`/`bunx`, not `npm`/`npx`). The exact version is declared on the `bun` line of `.tool-versions`, because Bun writes `bun.lock` and builds the bundles that store reviewers rebuild. With [mise](https://mise.jdx.dev) or asdf, `mise install` in the repo picks it up, and inside the repo it then takes precedence over a Bun installed some other way (Homebrew, the bun.sh script); otherwise install that exact version with `curl -fsSL https://bun.sh/install | bash -s "bun-v<version>"`. CI reads the same line through `oven-sh/setup-bun`, which takes everything after `bun` as the version, so keep that line free of trailing comments. `@types/bun` in `package.json` must be the same version (`__tests__/toolchain-bun.spec.ts` checks). Dependabot still proposes `@types/bun` updates, and each such PR fails on purpose until you set the `bun` line to the same version on its branch: that is how a new Bun release gets noticed.
- [Node.js](https://nodejs.org) -- Bun launches the tools, but `tsc`, `eslint`, `prettier`, `vitest`, `web-ext` and the Tailwind step of the build all run on Node, because their launchers ask for it and `bunx` obeys. The version is declared in `.tool-versions` (the 24.x line, at or above the floor in the `engines` field of `package.json`). With [mise](https://mise.jdx.dev) or asdf, `mise install` in the repo picks it up; otherwise install that line yourself. CI reads the same file through `actions/setup-node`, whose released parser takes the first line that is a single bare token (optionally prefixed by `node`), so keep comment lines in that file multi-word and do not move the declaration into `mise.toml`, `.node-version` or `.nvmrc`: setup-node cannot read the first, and mise ignores the other two by default.
- [just](https://github.com/casey/just) -- this is the task runner. Every project task is a `just` recipe.

Everything else is a local dependency. First-time setup:

```bash
git clone git@github.com:j127/auto_delete_cookies_for_privacy.git
cd auto_delete_cookies_for_privacy
just install
```

## Everyday commands

| Command                    | What it does                                                                                                |
| -------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `just dev`                 | Watch mode: rebuilds bundles into `extension/` on every change                                              |
| `just build`               | One-shot build                                                                                              |
| `just check`               | TypeScript type-check (no emit)                                                                             |
| `just lint`                | ESLint over the whole repo (flat config, `eslint.config.mjs`)                                               |
| `just test`                | Vitest suite with coverage; fails if coverage drops below the thresholds in `vitest.config.ts`              |
| `just format`              | Prettier over the repo                                                                                      |
| `just ci`                  | Everything the main CI job runs, in the same order; run it before you open a PR                             |
| `just package_zip`         | Build and zip `extension/` into `builds/`                                                                   |
| `just build_firefox`       | Build the Firefox artifact into `builds/firefox/` (generated manifest, event-page background)               |
| `just run_firefox`         | Build, then launch Firefox via `web-ext` with the extension temporarily installed                           |
| `just lint_firefox`        | Build, then run Mozilla's `web-ext lint` over the Firefox artifact (the same linter AMO runs on submission) |
| `just package_zip_firefox` | Build and zip the Firefox artifact into `builds/`                                                           |

To try your build: `just build`, open `brave://extensions` (or `chrome://extensions`), enable Developer Mode, "Load unpacked", select the `extension/` folder. For Firefox, `just run_firefox` launches a throwaway profile with the extension loaded; to install manually instead, `just build_firefox`, open `about:debugging#/runtime/this-firefox`, "Load Temporary Add-on", and pick any file inside `builds/firefox/`.

New recipes go in the `justfile` with `snake_case` names and a one-line description on the comment line directly above them. That line is what `just --list` shows, so longer notes go above it; `__tests__/justfile.spec.ts` checks that it reads on its own.

## Branches

`main` is the only long-lived branch. Every change reaches it through a pull request, CI runs on every push to `main` and on every pull request into it, and releases are tagged on it.

- **Issue work** happens on a short-lived branch named `issue/<number>-<short-description>`, for example `issue/391-pin-bun`. Start it from an up-to-date `main`: run `git fetch origin` first, then branch from `origin/main`.
- **Releases** are prepared on `release/X.Y.Z`: the version bump in `package.json` and `extension/manifest.json`, plus the entry in `src/ui/settings/release-notes.json`. Once that merges, run `just release_check` on `main`, tag the commit `vX.Y.Z` and push the tag. The release workflow then builds the zips and drafts a GitHub release; publishing it and the store uploads stay manual (see `docs/store/`).
- **Dependabot** opens its own `dependabot/...` branches. Review them like any other pull request.
- **Merges** use a merge commit. Don't squash or rebase-merge, and never force-push `main` or otherwise rewrite its history.

## What a change needs

- **Tests.** All code changes come with tests. `just test` must pass, including the coverage thresholds — if your change meaningfully raises coverage, feel free to bump the floors in `vitest.config.ts` to the new baseline (the long-term target is 90%).
- **Green `just ci`** locally before you open the PR. It runs the same steps as the `ci` job in `.github/workflows/ci.yml`, in the same order, including Mozilla's add-on linter (`just lint_firefox`), the check AMO runs on every upload; `__tests__/ci-workflow.spec.ts` fails if the recipe and the job drift apart. Like CI, it installs from `bun.lock` without changing it, so if it stops at that first step, run `just install` and commit the updated `bun.lock`. CI also runs two jobs that `just ci` leaves out: `reproducible-firefox`, which rebuilds the Firefox add-on from a clean copy of the source and fails on any difference, and `e2e-firefox`, the real-Firefox tests (run them locally with `just e2e_firefox`, which needs Firefox installed).
- **Firefox changes**: run the relevant rows of the [manual Firefox test matrix](docs/testing-firefox.md) when touching cleanup, containers, or permissions behavior; a full recorded pass of the matrix gates each Firefox (AMO) release.
- **Scope discipline.** One issue per PR. Don't reformat or refactor code your change doesn't touch.
- **Comments stay.** Don't delete existing code comments unless the code they describe is going away — several carry load-bearing context (MV3 service-worker constraints, bundler quirks).
- **i18n**: user-facing strings go through `browser.i18n.getMessage` with a key in `extension/_locales/en/messages.json`. Key names are frozen once merged (30+ locale files reference them); only English values may change. A new key goes into all 32 locale files at once — seeded with the English text if nothing better is at hand — and `just check_locales` then fails until each locale gives it its own wording, because a seed nobody replaces ships as English to everyone (#409). If a language really does spell a label the English way, list that key for that locale in `scripts/locale-identity.ts` instead.

## Project constraints worth knowing

- The extension is Manifest V3. The committed `extension/` directory is the Chromium artifact (Chrome, Brave, Chromium); desktop Firefox is also supported, and `just build_firefox` assembles its separate artifact from a generated manifest.
- The background script is a service worker: it can be killed at any idle moment and restarted on the next event. Never rely on module-level state surviving between events; use `chrome.storage.session` for state that must survive a restart within a browser session. Event listeners must be registered synchronously at the top level of `src/background.ts`.
- Runtime enums live as plain `export enum` in `src/typings/enums.ts`. Never declare ambient `const enum`s in `.d.ts` files — Bun.build transpiles per-file and cannot inline them, which crashes at runtime while tests still pass.

## Reporting bugs

Use the issue templates. For runtime errors, include the background console output: on Chrome/Brave, `brave://extensions` → the extension's card → "Inspect views: service worker"; on Firefox, `about:debugging#/runtime/this-firefox` → the extension's "Inspect" button (Firefox runs an event page, not a service worker).
