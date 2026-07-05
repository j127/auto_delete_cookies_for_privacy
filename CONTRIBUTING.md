# Contributing

Thanks for helping out. This page covers the toolchain, the branch rules, and what a change needs before it merges.

## Toolchain

You need two tools installed globally:

- [Bun](https://bun.sh) >= 1.3 — package manager and bundler (there is no npm/node workflow here; use `bun`/`bunx`, not `npm`/`npx`)
- [just](https://github.com/casey/just) — task runner; every project task is a `just` recipe

Everything else is a local dependency. First-time setup:

```bash
git clone git@github.com:j127/autodelete_cookies_for_privacy.git
cd autodelete_cookies_for_privacy
just install
```

## Everyday commands

| Command                               | What it does                                                                                                                          |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `just dev`                            | Watch mode: rebuilds bundles into `extension/` on every change                                                                        |
| `just build`                          | One-shot build                                                                                                                        |
| `just check`                          | TypeScript type-check (no emit)                                                                                                       |
| `just lint`                           | ESLint over the whole repo (flat config, `eslint.config.mjs`)                                                                         |
| `just test`                           | Jest suite with coverage; fails if coverage drops below the thresholds in `jest.config.js`                                            |
| `just format`                         | Prettier over the repo                                                                                                                |
| `just ci`                             | Exactly what CI runs: install, check, lint, test, build                                                                               |
| `just package_zip`                    | Build and zip `extension/` into `builds/`                                                                                             |
| `just docs_build` / `just docs_serve` | Build or live-serve the user docs in `documentation/` (needs `mdbook` + `mdbook-mermaid`, e.g. `cargo install mdbook mdbook-mermaid`) |

To try your build: `just build`, open `brave://extensions` (or `chrome://extensions`), enable Developer Mode, "Load unpacked", select the `extension/` folder.

New recipes go in the `justfile` with `snake_case` names.

## Branch and merge rules

- `main` holds the released state. Nothing lands there directly; the final merge from the working branch into `main` is done manually by the maintainer after hands-on testing.
- Ongoing work happens on the working branch (currently `manifest-v3-prep`) via short-lived branches, one per issue: branch off the working branch, open a PR back into it.
- PRs merge with a **merge commit** — never squash, never rebase-merge.
- Never rewrite or force-push shared history.

## What a change needs

- **Tests.** All code changes come with tests. `just test` must pass, including the coverage thresholds — if your change meaningfully raises coverage, feel free to bump the floors in `jest.config.js` to the new baseline (the long-term target is 90%).
- **Green `just ci`** locally before you open the PR; the GitHub Actions workflow runs the same recipes.
- **Scope discipline.** One issue per PR. Don't reformat or refactor code your change doesn't touch.
- **Comments stay.** Don't delete existing code comments unless the code they describe is going away — several carry load-bearing context (MV3 service-worker constraints, bundler quirks).
- **i18n**: user-facing strings go through `browser.i18n.getMessage` with a key in `extension/_locales/en/messages.json`. Key names are frozen once merged (30+ locale files reference them); only English values may change.

## Project constraints worth knowing

- The extension is Manifest V3, Chromium-only (Chrome, Brave, Chromium). Firefox support was deliberately removed — don't add browser detection or Firefox branches back.
- The background script is a service worker: it can be killed at any idle moment and restarted on the next event. Never rely on module-level state surviving between events; use `chrome.storage.session` for state that must survive a restart within a browser session. Event listeners must be registered synchronously at the top level of `src/background.ts`.
- Runtime enums live as plain `export enum` in `src/typings/enums.ts`. Never declare ambient `const enum`s in `.d.ts` files — Bun.build transpiles per-file and cannot inline them, which crashes at runtime while tests still pass.

## Reporting bugs

Use the issue templates. For runtime errors, include the service worker console output: `brave://extensions` → the extension's card → "Inspect views: service worker".
