#!/usr/bin/env bash

# Preflight for tagging a release: package.json and extension/manifest.json
# must agree on the version, the generated Firefox manifest must carry the
# same version plus a well-formed gecko id, the in-app release notes must
# have an entry for that version, and the working tree must be clean.

set -euo pipefail

pkg_version=$(bun -e "console.log(require('./package.json').version)")
mf_version=$(bun -e "console.log(require('./extension/manifest.json').version)")

if [ "$pkg_version" != "$mf_version" ]; then
  echo "Version mismatch: package.json=$pkg_version extension/manifest.json=$mf_version" >&2
  exit 1
fi

# The Firefox manifest is generated from the Chrome one at build time; run
# the same transform here so a release cannot tag with a broken or
# version-skewed Firefox manifest.
ff_version=$(bun -e "
const { buildFirefoxManifest } = await import('./scripts/firefox_manifest.ts');
const manifest = buildFirefoxManifest(require('./extension/manifest.json'));
if (!/^\{[0-9a-f-]{36}\}\$/.test(manifest.browser_specific_settings.gecko.id)) {
  throw new Error('firefox manifest gecko.id is not a GUID');
}
console.log(manifest.version);
")

if [ "$pkg_version" != "$ff_version" ]; then
  echo "Version mismatch: package.json=$pkg_version firefox manifest=$ff_version" >&2
  exit 1
fi

# The settings Welcome page renders src/ui/settings/release-notes.json, whose
# newest entry is what users see as "this release". Nothing tied it to the
# version before, and it drifted: 1.1.2 shipped only after backfilling the
# 1.1.0 and 1.1.1 entries, because the page still showed 1.0.1 as newest.
notes_version=$(bun -e "console.log(require('./src/ui/settings/release-notes.json').releases[0].version)")

if [ "$pkg_version" != "$notes_version" ]; then
  echo "Version mismatch: package.json=$pkg_version newest release note=$notes_version" >&2
  echo "Add an entry for $pkg_version at the top of src/ui/settings/release-notes.json" >&2
  exit 1
fi

if [ -n "$(git status --porcelain)" ]; then
  echo "Working tree is not clean:" >&2
  git status --short >&2
  exit 1
fi

echo "release_check OK: version $pkg_version, clean tree"
