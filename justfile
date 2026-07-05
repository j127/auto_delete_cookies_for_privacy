# List available recipes
default:
  @just --list

# Install dependencies with Bun
install:
  bun install

# Compile bundles into extension/bundles (webpack until the Bun.build swap)
build:
  bunx webpack --config webpack.config.js --color

# Rebuild on change
dev:
  bunx webpack --config webpack.config.js --progress --color --watch

# Type-check without emitting
check:
  bunx tsc --noEmit

# Run the test suite with coverage
test:
  bunx jest --coverage

# Lint sources
lint:
  bunx eslint -c .eslintrc.json --ext .ts,.tsx src/

# Format the repo
format:
  bunx prettier --write .

# Verify formatting
format_check:
  bunx prettier --check .

# Everything CI runs, in order
ci: install check lint test build

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
