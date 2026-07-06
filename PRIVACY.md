# Privacy Policy — Auto-Delete Cookies for Privacy

_Last updated: 2026-07-05 (draft for the 1.0.0 release)_

## The short version

This extension deletes data; it does not collect it. Everything the extension knows lives inside your browser, nothing is ever transmitted anywhere, and uninstalling the extension removes all of it.

## What the extension stores

All storage is local to your browser profile, via the browser's `storage` APIs:

- **Your settings and keep lists** (whitelist/greylist expressions) — stored with `browser.storage.local`, kept until you change them, reset them, or uninstall.
- **A per-session working state** (which tab is on which domain, a pending-cleanup marker, a cleanup log if you enable it, and cookie counters) — stored with `browser.storage.session`, which the browser itself erases when it exits.

The cleanup log, if enabled in settings, records which domains had data removed and why. It never leaves your machine, is capped in size, never includes cookie values, and is never written for private/incognito tabs.

## What the extension transmits

Nothing. The extension makes no network requests of its own: no telemetry, no analytics, no crash reporting, no update pings, no third-party services, no remote configuration. The only network activity related to the extension is the store download/update mechanism operated by your browser vendor, which is outside the extension's control.

## What the extension never sees

Cookie values are read only in transit to `browser.cookies.remove` calls inside your browser. They are not logged (debug output masks them), not persisted, and not displayed beyond the cookie names a site set, which you can inspect when editing an expression.

## Permissions, one by one

| Permission                | Why the extension needs it                                                                                                                                                                                |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cookies`                 | The core job: list and delete cookies for sites you close, and show the per-site cookie count.                                                                                                            |
| `browsingData`            | Delete the other kinds of site data you opt into cleaning: cache, IndexedDB, LocalStorage, plugin data, service workers.                                                                                  |
| `storage`                 | Save your settings and keep lists locally; keep the small per-session working state that survives service-worker restarts.                                                                                |
| `alarms`                  | Schedule the delayed automatic cleanup reliably under Manifest V3, where the background worker may be suspended while a delay is pending.                                                                 |
| `tabs`                    | Know which domains are open in tabs (so their data is kept), and react when a tab closes or changes domain.                                                                                               |
| `activeTab`               | Act on the current tab for popup actions without needing anything broader at click time.                                                                                                                  |
| `scripting`               | Run the on-demand "wipe LocalStorage for this site" action inside the target tab, since MV3 removed inline script execution.                                                                              |
| `contextMenus`            | The optional right-click menu (manual cleanups, add-to-list shortcuts). Can be turned off in settings.                                                                                                    |
| `notifications`           | The optional "cleaned X sites" notifications. Can be turned off in settings.                                                                                                                              |
| Host access: `<all_urls>` | Cookies can belong to any site you visit, so reading and deleting them requires host access to all sites. The extension uses it exclusively for cookie/site-data cleanup — it does not read page content. |

## Children's privacy, sale of data, third parties

There is no data to sell, share, or process: the extension has no accounts, no server, and no third-party integrations of any kind.

## Changes to this policy

This file is versioned with the source code; any change to it is visible in the repository history. Material changes will be called out in the release notes.

## Contact

Questions or concerns: open an issue at <https://github.com/j127/auto_delete_cookies_for_privacy/issues>.
