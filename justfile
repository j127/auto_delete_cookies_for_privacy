# List available recipes
default:
  @just --list

# Install dependencies with Bun
install:
  bun install

# Compile bundles into extension/bundles
build:
  bun run scripts/build.ts

# Rebuild on change
dev:
  bun run scripts/build.ts --watch

# Type-check without emitting
check:
  bunx tsc --noEmit

# Run the test suite with coverage
test:
  bunx vitest run

# Lint sources
lint:
  bunx eslint .

# Format the repo
format:
  bunx prettier --write .

# Verify formatting
format_check:
  bunx prettier --check .

# Everything CI runs, in order
ci: install check lint format_check check_locales test build

# Regenerate the extension icon PNGs from image_editing/cookie-prohibited.svg
# (requires rsvg-convert: `brew install librsvg`; the PNGs are committed, so
# CI never needs it)
icons_build:
  bun run scripts/icons.ts

# Zip extension/ into builds/ for Chrome
package_zip: build
  #!/usr/bin/env bash
  set -euo pipefail
  mkdir -p builds
  version=$(git describe --tags --always)
  cd extension && zip -q -r -9 "../builds/Auto-Delete-Cookies-for-Privacy_${version}_Chrome.zip" . -x "*.map"
  echo "builds/Auto-Delete-Cookies-for-Privacy_${version}_Chrome.zip"

# Preflight for tagging a release: version parity + clean tree
release_check:
  ./scripts/release_check.sh

# Remove build artifacts
clean:
  ./scripts/clean.sh

# Verify every locale matches en: key sets, placeholder tokens, brand name.
check_locales:
    bun scripts/check_locales.ts
