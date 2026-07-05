#!/usr/bin/env bash

# Preflight for tagging a release: package.json and extension/manifest.json
# must agree on the version, and the working tree must be clean.

set -euo pipefail

pkg_version=$(bun -e "console.log(require('./package.json').version)")
mf_version=$(bun -e "console.log(require('./extension/manifest.json').version)")

if [ "$pkg_version" != "$mf_version" ]; then
  echo "Version mismatch: package.json=$pkg_version extension/manifest.json=$mf_version" >&2
  exit 1
fi

if [ -n "$(git status --porcelain)" ]; then
  echo "Working tree is not clean:" >&2
  git status --short >&2
  exit 1
fi

echo "release_check OK: version $pkg_version, clean tree"
