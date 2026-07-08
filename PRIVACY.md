# Privacy Policy

_Last updated: 2026-07-07_

This policy covers the **Auto-Delete Cookies for Privacy** browser extension. The extension has a single purpose: it automatically deletes cookies and other site data left behind by sites you close, and lets you trigger the same cleanup manually.

**Auto-Delete Cookies for Privacy deletes data; it does not collect it.**

## What the extension collects and transmits

Nothing. Specifically:

- No personal information, browsing history, page content, or usage data is collected.
- Nothing is transmitted off your device — the extension makes no network requests of its own and has no server.
- There are no analytics, telemetry, crash reporting, advertising, or tracking of any kind.
- There are no user accounts and no third-party services involved.
- Your data is never sold, shared, or transferred to anyone.

## What the extension stores, locally only

The extension keeps its own working data in your browser's local extension storage on your device:

- Your settings and your keep lists (the sites whose data you chose to preserve).
- An optional activity log and cleanup statistics, if you leave those features enabled; both can be disabled and cleared in the settings.
- Small per-session working state (for example, which cleanup is scheduled) that lets the background worker resume after the browser suspends it.

This data never leaves your device, is not synced through any account, and is removed by the browser when you uninstall the extension. The settings export feature writes a file only when you ask it to, to the location you choose, and the import feature only reads a file you explicitly select.

## What the extension deletes

Its job: cookies for sites you close, and — only for the data types you opt into — cache, IndexedDB, LocalStorage, plugin data, and service workers. Deletion happens entirely inside your browser through the browser's own extension APIs. The extension reads cookie metadata (domain, name, container) to decide what to delete and to show per-site counts; it does not read page content.

## Permissions Explained

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

## Remote code

None. All code ships inside the extension package reviewed by the store; the extension never downloads, evaluates, or executes remote code.

## Changes and contact

This file is versioned with the source code, so every change to it is visible in the repository history; material changes are called out in the release notes. Questions or concerns: open an issue at <https://github.com/j127/auto_delete_cookies_for_privacy/issues>.
