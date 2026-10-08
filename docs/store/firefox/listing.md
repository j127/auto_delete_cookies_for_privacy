# AMO listing copy

Everything the addons.mozilla.org "Describe Add-on" pages ask for. Permission justifications and the data-collection declaration live in [permissions.md](permissions.md); the submission steps live in [runbook.md](runbook.md).

## Name

> Auto-Delete Cookies for Privacy

## Summary (250-char limit)

> Automatically deletes cookies and site data when you close tabs, except for sites that you mark as safe. Container-aware: each Firefox container can have its own keep list.

(The first sentence matches `extensionDescription` in the locale files; the other 31 locale values can seed per-locale summaries.)

## Description

AMO renders limited HTML; paste as plain text with blank-line paragraphs:

```text
Auto-Delete Cookies for Privacy cleans up after your tabs: when you close a site's tabs, its cookies and site data are deleted automatically — except for the sites you mark as safe.

HOW IT WORKS
• Close a site's tabs and, after a short grace period you control, its cookies are gone.
• Clean the rest of a site's footprint too (on unless you turn it off): IndexedDB, LocalStorage, service workers, and plugin data. (Firefox cannot clear its cache for individual sites, so cache cleanup is excluded on Firefox.)
• Keep lists protect the sites you choose: keep a site's data permanently, or only until the browser closes.
• Nothing is cleaned automatically until you switch automatic cleaning on — and manual cleaning works even while it is off.

BUILT FOR FIREFOX
• Container-aware: see the active tab's container in the popup, and give every Firefox container its own keep list — or manage one shared list, your choice.
• Works with Total Cookie Protection: partitioned third-party cookies are found and cleaned with everything else.
• Works with First-Party Isolation profiles, and still cleans up isolated leftovers after you turn FPI off.
• Private-browsing keep lists work as advertised, and private domains never appear in the activity log.

THE POPUP
• See how many cookies the current site has set, and inspect what else it stores on your device.
• Clean the current site's data, or run a full cleanup, with one click.
• Add the current site to your keep list without leaving the page.

PRIVATE BY DESIGN
• Deletes data, collects none: no analytics, no telemetry, no accounts, and no network requests.
• Everything is processed and stored locally in your browser.
• Open source: https://github.com/j127/auto_delete_cookies_for_privacy

SWITCHING FROM COOKIE AUTODELETE?
Auto-Delete Cookies for Privacy is a maintained successor to the archived Cookie AutoDelete. Import your existing Cookie AutoDelete settings export on the Import / Export page: your lists carry over, container lists included.

DETAILS
• Manifest V3; Firefox 140 (ESR) or newer, desktop only.
• Available in 32 languages.
• Optional cleanup log, statistics, and notifications.
```

## Categories and metadata

- Category: Privacy & Security.
- License: MIT (matches the repo LICENSE).
- Support site / homepage: the GitHub repo URL.
- Support email: `support@moakh.dev`, so people without a GitHub account can reach us. It is the address the extension's Support page shows.
- Privacy policy: paste `PRIVACY.md` into the listing's privacy-policy field (AMO hosts its own copy).
- Tags: cookies, privacy, containers, cleaner.

## Assets

### Icon

Upload `extension/icons/icon_128.png` as the listing icon on Edit Product Page → Media. AMO does not take the listing icon from the manifest: without the upload the listing shows AMO's default puzzle-piece icon.

### Screenshots

Upload these from `docs/store/screenshots/firefox/` on Edit Product Page → Media, in this order, and paste each caption into the screenshot's caption field. All are 1280×800 PNGs of the real Firefox build (popup, Protection, Saved sites and Overview), each in the light and the dark theme.

| File                                                                      | Caption                                                                                            |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| [01-popup.png](../screenshots/firefox/01-popup.png)                       | The popup shows the site's container and what the site stores, and keeps its cookies in one click. |
| [01-popup-dark.png](../screenshots/firefox/01-popup-dark.png)             | The popup shows the site's container and what the site stores, and keeps its cookies in one click. |
| [02-protection.png](../screenshots/firefox/02-protection.png)             | Give each Firefox container its own keep list from the Protection page.                            |
| [02-protection-dark.png](../screenshots/firefox/02-protection-dark.png)   | Give each Firefox container its own keep list from the Protection page.                            |
| [03-saved-sites.png](../screenshots/firefox/03-saved-sites.png)           | Saved sites holds a separate keep list for each container, next to the Default and Private lists.  |
| [03-saved-sites-dark.png](../screenshots/firefox/03-saved-sites-dark.png) | Saved sites holds a separate keep list for each container, next to the Default and Private lists.  |
| [04-overview.png](../screenshots/firefox/04-overview.png)                 | The Overview counts the cookies deleted so far and lists what is new in each release.              |
| [04-overview-dark.png](../screenshots/firefox/04-overview-dark.png)       | The Overview counts the cookies deleted so far and lists what is new in each release.              |

The captions also live in `e2e/helpers/store_screenshots.ts`, and a unit test keeps the two in step. To refresh the set for a new release, run the "Store screenshots" workflow from the Actions tab (it runs `just store_screenshots_firefox` on Linux, on the Firefox release that CI tests), download its `firefox-store-screenshots` artifact, look at every image, and commit the ones that changed. Firefox started from some macOS 27 terminals cannot open its profile (#465), so the workflow is the dependable way to take them.

The Chrome Web Store screenshots in `docs/store/screenshots/` are a separate set and are not uploaded to AMO.
