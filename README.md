# Auto-Delete Cookies for Privacy

Control your cookies! When a tab closes, any cookies not being used are automatically deleted. Prevent tracking by other cookies and add only the ones you trust. Easily import and export your cookie whitelist.

This is a maintained fork of [Cookie AutoDelete](https://github.com/Cookie-AutoDelete/Cookie-AutoDelete) (by Kenny Do and the CAD Team, MIT licensed), which was archived upstream and delisted from the Chrome Web Store when Manifest V2 support ended. This fork migrates the extension to Manifest V3 and targets Chrome, Brave, and other Chromium browsers.

> **Status:** under active migration to Manifest V3 on the `manifest-v3-prep` branch. Not yet published to the Chrome Web Store.

## Main features

- Automatically deletes cookies from closed tabs
- Whitelist/Greylist support for cookies
- Easily export/import your configurations
- Clear all cookies for a domain
- Supports manual mode cleaning from the popup
- Easily see the number of cookies for a site

Firefox-specific features of the original (Container Tabs support) remain in the codebase behind feature guards but are not currently shipped; this fork targets Chromium browsers only.

## Usage

1. Add the sites you want to keep cookies for to the whitelist (permanently) or greylist (until browser restart)
2. Enable "Automatic Cleaning" in settings or "Auto-Clean" in popup
3. Watch those unused cookies disappear :)

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

## Internationalization

Translations were inherited from the original project's Crowdin community. The extension name is intentionally untranslated; everything else remains localized in 30+ languages.

## License

MIT. Original work copyright (c) 2017-2022 Kenny Do and CAD Team; fork modifications copyright (c) 2026 j127. See [LICENSE](LICENSE).
