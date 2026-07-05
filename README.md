# Auto-Delete Cookies for Privacy

A browser extension that tidies up after your tabs. Close a tab, and the cookies and site data that page left behind get wiped automatically — unless you've put the site on a keep list. Sites you trust keep working; everything else forgets you were there.

This is a maintained fork of [Cookie AutoDelete](https://github.com/Cookie-AutoDelete/Cookie-AutoDelete) (by Kenny Do and the CAD Team, MIT licensed), which was archived upstream and delisted from the Chrome Web Store when Manifest V2 support ended. This fork migrates the extension to Manifest V3 and targets Chrome, Brave, and other Chromium browsers.

> **Status:** under active migration to Manifest V3 on the `manifest-v3-prep` branch. Not yet published to the Chrome Web Store.

## What it does

- Wipes cookies from a site shortly after its last tab closes
- Two keep lists: a whitelist (never cleaned) and a greylist (survives until the browser restarts)
- Optionally clears other leftovers too: LocalStorage, IndexedDB, cache, service workers, plugin data
- One-click manual cleanup for the current site from the popup or right-click menu
- Toolbar badge shows how many cookies the current site has set
- Keep-list rules support wildcards and regular expressions, and can be exported/imported as files

The original's Firefox-only features (Container Tabs, First-Party Isolation) have been removed from this fork rather than carried as dead weight. Firefox still supports Manifest V2, so Firefox users can simply keep using the upstream Cookie AutoDelete.

## Usage

1. Put sites whose cookies you want to keep on the whitelist, or on the greylist if they should only survive until the browser restarts
2. Turn on automatic cleaning (in the settings page, or the toggle in the popup)
3. Browse normally — cleanup runs by itself a few seconds after you close a site's last tab

## Installation

Not yet on the Chrome Web Store (coming with the 4.0.0 release). Until then:

1. Clone this repo and build it (see Development below)
2. Open `brave://extensions` (or `chrome://extensions`), enable Developer Mode
3. "Load unpacked" and select the `/extension` folder

Migrating from the original Cookie AutoDelete: export your settings from the old extension (Settings > Export), then import them here — the storage format is compatible.

## Development

Requirements: [Bun](https://bun.sh) >= 1.3 and [just](https://github.com/casey/just).

- `just install` - Install all dependencies
- `just dev` - Watch mode: rebuilds bundles into `/extension` on change
- `just build` - One-shot build
- `just check` - Type-check
- `just lint` - Lint
- `just test` - Run the test suite
- `just package_zip` - Build and zip the extension into `/builds`
- `just ci` - Everything CI runs, in order

Load `/extension` as an unpacked extension to test (see Installation above).

Contribution guidelines (branch rules, test expectations): [CONTRIBUTING.md](CONTRIBUTING.md).

## Privacy

The extension deletes data; it never collects or transmits any. All state lives in your browser and nothing leaves your machine. The permission-by-permission breakdown lives in [PRIVACY.md](PRIVACY.md).

## Internationalization

Translations were inherited from the original project's Crowdin community. The extension name is intentionally untranslated; everything else remains localized in 30+ languages.

## License

MIT. Original work copyright (c) 2017-2022 Kenny Do and CAD Team; fork modifications copyright (c) 2026 j127. See [LICENSE](LICENSE).
