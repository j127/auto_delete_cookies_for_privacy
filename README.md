# Auto-Delete Cookies for Privacy

This is a browser extension for Chrome, Brave, and Firefox that automatically deletes cookies and other site data when you close tabs, except for sites that you mark as safe.

**Auto-Delete Cookies for Privacy** is based on Cookie-AutoDelete, but it works with Manifest v3, and it has some new features too. It also fixes some silent bugs that are found in the older Cookie-AutoDelete extension and some of the other forks.

## What it does

- Deletes cookies (and other site data) from a site shortly after its last tab closes
- Two kinds of keep rules: **Keep** (never cleaned) and **Keep until browser closes**
- Clears other leftovers too, unless you turn that off: LocalStorage, IndexedDB, cache, service workers, plugin data
- One-click manual cleanup for the current site from the popup or right-click menu
- Turn automatic cleaning off from the popup for an hour, until the browser restarts, or until you turn it back on; Alt+Shift+D turns it off and on (change the key on your browser's extension shortcuts page)
- Toolbar badge shows how many cookies the current site has set
- Keep rules support wildcards and regular expressions, and can be exported/imported as files
- A rule can keep just some of a site's cookies, by name or by pattern (`auth_*` keeps every cookie whose name starts with `auth_`; `\*` is a literal asterisk). Older versions and Cookie AutoDelete read `auth_*` as one literal name, so a rule with patterns imported there cleans those cookies instead of keeping them
- Each Firefox container can have its own keep rules

### What Firefox won't let it clear

On Chrome and Brave, Cache Storage (the Cache API) is cleared together with service workers, and file-system storage (the origin private file system) together with IndexedDB. Firefox gives extensions no way to delete those two for a single site, and it can only clear its cache for the whole browser, so on Firefox all three stay behind after a cleanup. To remove them for one site, click the padlock in the address bar and choose "Clear cookies and site data…" (this also deletes the site's cookies). The Firefox side is tracked in Mozilla's [bug 1526246](https://bugzilla.mozilla.org/show_bug.cgi?id=1526246) (Cache API) and [bug 1535763](https://bugzilla.mozilla.org/show_bug.cgi?id=1535763) (clearing all of a site's storage).

### Firefox for Android

The Firefox build also runs on Firefox for Android 142 or newer, and on rebuilds of it such as Fennec F-Droid. A few things work differently there, because Firefox for Android gives extensions less to work with:

- There are no containers and no right-click menu, so those settings are hidden. There are no keyboard shortcuts either; use the switch in the popup.
- There are no windows, so the Private keep list (sites kept in private tabs) is erased when the last private tab closes, and when Firefox starts with no private tab open, rather than when the last private window closes.
- After a restart, Firefox only tells extensions about the tabs it has loaded again. So that sites in tabs you haven't opened yet don't get logged out, the extension remembers which sites were open and keeps their cookies until you open and close those tabs again. A tab closed from the tab tray without ever being opened keeps its site's cookies until the next "Clean now, including open tabs".

#### Recommended setup: the Keep list instead of "Delete browsing data on quit"

Firefox for Android's "Delete browsing data on quit" is all or nothing: it has no exceptions for sites you want to stay signed in to. The Keep list can do that job instead: sites you keep keep their cookies, and everything else is cleared, including the third-party cookies Firefox partitions under the sites you visit (one of those survives only when its own site is kept too).

1. In Firefox, open Settings → "Delete browsing data on quit" and make sure "Cookies and site data" is **not** selected (or turn the whole option off). If Firefox deletes cookies on quit, it deletes the cookies of the sites you kept too, and the Keep list can't bring them back.
2. In the extension's settings, turn on "Clean automatically" on the Protection page.
3. Keep the sites you want to stay signed in to: open the site, open the extension from Firefox's menu, and press "Keep cookies for this site".
4. To clear everything else every time Firefox starts, as "Delete browsing data on quit" would, turn on "Advanced mode", then check that "Session keep rules" is on (the startup cleanup only runs while it is) and turn on "Clean restored tabs on startup". With that on, sites in tabs you left open are cleaned at startup too, unless you keep them; with it off, the extension leaves the sites of open tabs alone, as described above.

Closing a site's last tab then cleans it after the grace period unless you keep it, and each start of Firefox cleans every site that isn't kept.

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
