# Chrome Web Store listing copy and assets

Everything the "Store listing" tab of the CWS dashboard asks for. Privacy-tab answers live in [permissions.md](permissions.md).

## Short description (132-char limit)

Use the same string as the manifest description (`extensionDescription` in `extension/_locales/en/messages.json`):

> Automatically deletes cookies and site data when you close tabs, except for sites that you mark as safe.

The other 31 locale values are already in the locale files and within the limit, so per-locale store listings can reuse them verbatim.

## Detailed description

Paste as plain text — the CWS field renders no markdown:

```text
Auto-Delete Cookies for Privacy cleans up after your tabs: when you close a site's tabs, its cookies and site data are deleted automatically — except for the sites you mark as safe.

HOW IT WORKS
• Close a site's tabs and, after a short grace period you control, its cookies are gone.
• Optionally clean the rest of a site's footprint too: cache, IndexedDB, LocalStorage, service workers, and plugin data.
• Keep lists protect the sites you choose: keep a site's data permanently, or only until the browser closes.
• Nothing is cleaned automatically until you switch automatic cleaning on — and manual cleaning works even while it is off.

THE POPUP
• See how many cookies the current site has set, and inspect what else it stores on your device (local storage, databases, caches, service workers).
• Clean the current site's data, or run a full cleanup, with one click.
• Add the current site to your keep list without leaving the page.

PRIVATE BY DESIGN
• Deletes data, collects none: no analytics, no telemetry, no accounts, and no network requests.
• Everything is processed and stored locally in your browser.
• Open source: https://github.com/j127/auto_delete_cookies_for_privacy

SWITCHING FROM COOKIE AUTODELETE?
Auto-Delete Cookies for Privacy is a maintained successor to the archived Cookie AutoDelete, rebuilt for Manifest V3 Chromium. Import your existing Cookie AutoDelete settings export on the Import / Export page and your lists carry over (container lists fold into the default list, since Chromium has no containers).

DETAILS
• Manifest V3; Chrome 120 or newer. Works in Chrome, Brave, Edge, and other Chromium browsers.
• Available in 32 languages.
• Optional cleanup log, statistics, and notifications.
```

## Assets

| Asset                      | File                                 | Dashboard field                  |
| -------------------------- | ------------------------------------ | -------------------------------- |
| Screenshot 1 (1280x800)    | `screenshots/01-popup.png`           | Store listing → Screenshots      |
| Screenshot 2 (1280x800)    | `screenshots/02-settings.png`        | Store listing → Screenshots      |
| Small promo tile (440x280) | `screenshots/promo-tile-440.png`     | Store listing → Small promo tile |
| Store icon (128x128)       | `../../extension/icons/icon_128.png` | Uploaded with the package        |

Screenshots were captured from the real UI (light theme, 1280x800) with the extension state mocked to show a populated popup inspector and the Protection settings page.

## Icon legibility

`icon_128.png` was checked against the store's light (#ffffff) and dark (#292a2d) listing backgrounds — the red prohibition ring keeps its contrast on both, and the transparent padding does not clip. No rework needed.
