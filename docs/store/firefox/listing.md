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
• Optionally clean the rest of a site's footprint too: IndexedDB, LocalStorage, service workers, and plugin data. (Firefox cannot clear its cache for individual sites, so cache cleanup is excluded on Firefox.)
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
• Manifest V3; Firefox 128 (ESR) or newer, desktop only.
• Available in 32 languages.
• Optional cleanup log, statistics, and notifications.
```

## Categories and metadata

- Category: Privacy & Security.
- License: MIT (matches the repo LICENSE).
- Support site / homepage: the GitHub repo URL.
- Privacy policy: paste `PRIVACY.md` into the listing's privacy-policy field (AMO hosts its own copy).
- Tags: cookies, privacy, containers, cleaner.

## Assets

AMO screenshots have no fixed size requirement (unlike CWS); reuse the CWS screenshots from `docs/store/screenshots/` as-is, and add one Firefox-specific shot of the popup showing a container badge once a headed pass produces one. The icon comes from the manifest (`icons/icon_128.png`); no separate upload needed.
