# List available recipes
default:
  @just --list

# Install dependencies with Bun
install:
  bun install

# Install exactly what bun.lock records, as CI does (fails if it is stale)
install_frozen:
  bun install --frozen-lockfile

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

# Keep this in step with the "ci" job in .github/workflows/ci.yml: same
# steps, same order (__tests__/ci-workflow.spec.ts checks). CI's other two
# jobs are left out: the reproducibility check, and the real-Firefox tests
# (`just e2e_firefox`, which needs Firefox installed).
# Everything the main CI job runs, in the same order
ci: install_frozen check lint format_check check_locales test package_zip lint_firefox package_zip_firefox

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

# Build the Firefox artifact into builds/firefox
build_firefox:
  bun run scripts/build.ts --target firefox

# Launch Firefox with the freshly built extension temporarily installed
run_firefox: build_firefox
  bunx web-ext run --source-dir builds/firefox

# Lint the Firefox artifact with Mozilla's addons-linter (AMO's gate)
lint_firefox: build_firefox
  bunx web-ext lint --source-dir builds/firefox

# Zip the Firefox artifact into builds/ for AMO
package_zip_firefox: build_firefox
  #!/usr/bin/env bash
  set -euo pipefail
  version=$(git describe --tags --always)
  cd builds/firefox && zip -q -r -9 "../Auto-Delete-Cookies-for-Privacy_${version}_Firefox.zip" . -x "*.map"
  echo "builds/Auto-Delete-Cookies-for-Privacy_${version}_Firefox.zip"

# Real-Firefox end-to-end suite (headless; E2E_HEADED=1 to watch,
# FIREFOX_BIN=/path to pin a channel such as ESR, GECKODRIVER_VERSION=x.y.z
# to try a driver other than the pin in e2e/helpers/firefox_driver.ts)
e2e_firefox: package_zip_firefox
  bunx vitest run --config vitest.e2e.config.ts

# Preflight for tagging a release: version parity + clean tree
release_check:
  ./scripts/release_check.sh

# Remove build artifacts
clean:
  ./scripts/clean.sh

# Verify every locale matches en: key sets, placeholder tokens, brand name.
check_locales:
    bun scripts/check_locales.ts
