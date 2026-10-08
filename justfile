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
# steps, same order (__tests__/ci-workflow.spec.ts checks). CI's other three
# jobs are left out: the reproducibility check, the real-Firefox tests
# (`just e2e_firefox`, which needs Firefox installed), and the Chrome for
# Testing tests (`just e2e_chromium`, which needs the pinned build).
# Everything the main CI job runs, in the same order
ci: install_frozen check lint format_check check_locales test package_zip lint_firefox package_zip_firefox

# Requires rsvg-convert (`brew install librsvg`). The PNGs are committed, so
# CI never needs it.
# Regenerate the extension icon PNGs from image_editing/cookie-prohibited.svg
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

# On macOS it starts Firefox through `open` (scripts/firefox_via_open.sh):
# macOS 27 refuses a Firefox started as a child of another app's terminal
# access to its own app-data folder (#465). Elsewhere it launches directly.
# Launch Firefox with the freshly built extension temporarily installed
run_firefox: build_firefox
  #!/usr/bin/env bash
  set -euo pipefail
  if [ "$(uname)" = "Darwin" ]; then
    bunx web-ext run --source-dir builds/firefox --firefox "{{justfile_directory()}}/scripts/firefox_via_open.sh"
  else
    bunx web-ext run --source-dir builds/firefox
  fi

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

# Headless by default: E2E_HEADED=1 to watch, FIREFOX_BIN=/path to pin a
# channel such as ESR, GECKODRIVER_VERSION=x.y.z to try a driver other than
# the pin in e2e/helpers/firefox_driver.ts.
# Real-Firefox end-to-end suite (needs Firefox installed)
e2e_firefox: package_zip_firefox
  bunx vitest run --config vitest.e2e.config.ts

# Writes docs/store/screenshots/firefox/ (STORE_SHOT_DIR=/path to write
# elsewhere). Needs Firefox installed, so the "Store screenshots" workflow
# runs it on Linux and uploads the PNGs (docs/store/firefox/listing.md).
# Take the Firefox store screenshots from the packaged build
store_screenshots_firefox: package_zip_firefox
  bunx vitest run --config vitest.store-screenshots.config.ts

# It builds the Chrome bundles into extension/, the folder `just package_zip`
# zips, and loads that folder unpacked. Headless by default: E2E_HEADED=1 to
# watch, CHROME_BIN=/path to run a Chrome for Testing build other than the
# pin in e2e/helpers/chrome_cdp.ts (docs/testing-chromium.md).
# Chrome for Testing end-to-end suite (needs the pinned build installed)
e2e_chromium: build
  bunx vitest run --config vitest.e2e-chromium.config.ts

# Preflight for tagging a release: version parity + clean tree
release_check:
  ./scripts/release_check.sh

# Remove build artifacts
clean:
  ./scripts/clean.sh

# Verify every locale matches en: key sets, placeholder tokens, brand name.
check_locales:
    bun scripts/check_locales.ts
