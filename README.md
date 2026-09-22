# Auto-Delete Cookies for Privacy

This is a browser extension for Chrome, Brave, and Firefox that automatically deletes cookies and other site data when you close tabs, except for sites that you mark as safe.

**Auto-Delete Cookies for Privacy** is based on Cookie-AutoDelete, but it works with Manifest v3, and it has some new features too. It also fixes some silent bugs that are found in the older Cookie-AutoDelete extension and some of the other forks.

## What it does

- Deletes cookies (and other site data) from a site shortly after its last tab closes
- Two kinds of keep rules: **Keep** (never cleaned) and **Keep until browser closes**
- Optionally clears other leftovers too: LocalStorage, IndexedDB, cache, service workers, plugin data
- One-click manual cleanup for the current site from the popup or right-click menu
- Toolbar badge shows how many cookies the current site has set
- Keep rules support wildcards and regular expressions, and can be exported/imported as files
- Each Firefox container can have its own keep rules

## Install

- **Chrome, Brave, and other Chromium browsers** -- [Chrome Web Store](https://chromewebstore.google.com/detail/auto-delete-cookies-for-p/ghnodpmkiilfdelcloblidoeecblgbfp)
- **Firefox** -- [addons.mozilla.org](https://addons.mozilla.org/firefox/addon/autodelete-cookies-for-privacy/)

Manual fallback: download the zip for your browser from the [latest release](https://github.com/j127/auto_delete_cookies_for_privacy/releases/latest).

- Chromium: unzip the `_Chrome.zip` build, then open `chrome://extensions`, enable Developer mode, and use "Load unpacked" on the folder
- Firefox: open `about:debugging#/runtime/this-firefox`, choose "Load Temporary Add-on", and pick the `_Firefox.zip` build

## Usage

1. Mark the sites whose cookies you want to keep as **Keep**, or **Keep until browser closes** if they should only survive the session
2. Turn on automatic cleaning (in the settings page, or the toggle in the popup)
3. Browse normally -- cleanup runs by itself a few seconds after you close a site's last tab

## Support

If anything doesn't work or you have feature requests, please [create an issue](https://github.com/j127/auto_delete_cookies_for_privacy/issues), and I'll try to get it fixed within 48 hours.

## Development

Requirements: [Bun](https://bun.sh/), [Node.js](https://nodejs.org/) and [just](https://github.com/casey/just). The exact Bun version and the Node line are set in [.tool-versions](.tool-versions); [CONTRIBUTING.md](CONTRIBUTING.md) explains how to install them.

- `just install` - Install all dependencies
- `just dev` - Watch mode: rebuilds bundles into `/extension` on change
- `just build` - One-shot build
- `just check` - Type-check
- `just lint` - Lint
- `just test` - Run the test suite
- `just package_zip` - Build and zip the extension into `/builds`
- `just ci` - Everything the main CI job runs, in the same order

Load `/extension` as an unpacked extension to test.

Contribution guidelines (branch rules, test expectations): [CONTRIBUTING.md](CONTRIBUTING.md).

## Privacy

This extension doesn't collect any data. There isn't any tracking. See the [Privacy Policy](PRIVACY.md) for details.

## Internationalization

The extension ships localized in 30+ languages.

## License

MIT. Original work copyright (c) 2017-2022 Kenny Do and CAD Team; fork modifications copyright (c) 2026 j127. See [LICENSE](LICENSE).

**Auto-Delete Cookies for Privacy** is a fork of [Cookie AutoDelete (CAD)](https://github.com/Cookie-AutoDelete/Cookie-AutoDelete) which was removed from the Chrome Web Store when Manifest V2 support ended (attribution in [LICENSE](LICENSE)). It has been rebuilt for Manifest V3, along with other changes.
