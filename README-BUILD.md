# Building this extension from source

Build instructions for add-on reviewers (AMO source-code submission) and anyone who wants to reproduce the shipped artifacts exactly. The bundles ship unminified on purpose, so the built output is directly reviewable.

## Environment

- Any 64-bit Linux or macOS. Releases are built on `ubuntu-latest` GitHub runners.
- [Bun](https://bun.sh) at exactly the version pinned in [.bun-version](.bun-version) (install a specific version with `curl -fsSL https://bun.sh/install | bash -s "bun-v<version>"`). Bun is the package manager and the bundler; no Node.js/npm is used.
- No other global tools are required to build. (`just` is only a task-runner convenience; every command below is spelled out.)

## Steps

```bash
bun install --frozen-lockfile   # exact dependency tree from bun.lock
bun run scripts/build.ts --target firefox
```

That produces the complete Firefox artifact in `builds/firefox/`:

- `bundles/` — ESM JavaScript built by `Bun.build` from `src/` (unminified, with license banner) plus the compiled Tailwind stylesheet
- `manifest.json` — generated from `extension/manifest.json` by `scripts/firefox_manifest.ts` (event-page background, `contextualIdentities` permission, `browser_specific_settings.gecko`)
- everything else — static assets copied verbatim from `extension/`

The Chrome artifact is `extension/` itself after `bun run scripts/build.ts` (no `--target`; only `extension/bundles/` is generated).

## Packaging

The store zip is the artifact directory zipped without sourcemaps:

```bash
cd builds/firefox && zip -q -r -9 ../out_Firefox.zip . -x "*.map"
```

(equivalently: `just package_zip_firefox`).

## Verifying reproducibility

Unpack the shipped `*_Firefox.zip` and the one you just built and compare file-by-file — every file is byte-identical:

```bash
unzip -q out_Firefox.zip -d /tmp/mine
unzip -q shipped_Firefox.zip -d /tmp/shipped
diff -r /tmp/mine /tmp/shipped
```

CI enforces exactly this on every push: a job rebuilds from a clean `git archive` of the source tree and fails on any content difference. Zip container metadata (file timestamps) is the only thing not normalized, which is why the comparison is over the extracted contents.
