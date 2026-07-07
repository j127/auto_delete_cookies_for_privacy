# Privacy Policy — Auto-Delete Cookies for Privacy

_Last updated: 2026-07-07_

**Auto-Delete Cookies for Privacy deletes data; it does not collect it.** Everything the extension knows — your settings, your keep lists, and (if you enable it) a cleanup log of which sites had data removed — is stored locally in your browser profile and never leaves your machine. The extension makes no network requests of any kind: no telemetry, no analytics, no crash reporting, no update pings, no third-party services, and no server of its own. Cookie values are read only in transit to the browser's removal calls — never logged, persisted, or displayed beyond the cookie names a site set. Per-session working state is erased by the browser when it exits; the cleanup log is capped in size, contains no cookie values, and is never written for private/incognito tabs. There are no accounts, nothing is sold or shared, and uninstalling the extension removes everything.

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

## Changes and contact

This file is versioned with the source code, so every change to it is visible in the repository history; material changes are called out in the release notes. Questions or concerns: open an issue at <https://github.com/j127/auto_delete_cookies_for_privacy/issues>.
