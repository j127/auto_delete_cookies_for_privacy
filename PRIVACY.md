# Privacy Policy

_Last updated: 2026-11-10_

This policy covers the **Auto-Delete Cookies for Privacy** browser extension. The extension has a single purpose: it automatically deletes cookies and other site data left behind by sites you close, and lets you trigger the same cleanup manually.

**Auto-Delete Cookies for Privacy deletes data; it does not collect it.**

## What the extension collects and transmits

Nothing. Specifically:

- No personal information, browsing history, page content, or usage data is collected.
- Nothing is transmitted off your device by the extension — it makes no network requests of its own and has no server. The one thing that can leave your device is your keep list, and only if you turn on [optional sync](#optional-sync): then your browser, not the extension, carries it to your own browser account.
- There are no analytics, telemetry, crash reporting, advertising, or tracking of any kind.
- The extension has no accounts of its own and involves no third-party services.
- Your data is never sold, shared, or transferred to anyone.

The Firefox build declares this in the manifest itself: `data_collection_permissions` is set to `{ "required": ["none"] }`, Mozilla's machine-readable form of "no data is collected or transmitted". Optional sync doesn't change that: the synced copy stays in your own browser account and never reaches the developer.

## Optional sync

Sync is off by default, and each device turns it on for itself in the settings. While it is on, the extension keeps a copy of your Default keep list and your cleaning settings in the browser's extension sync storage (`storage.sync`), and your browser's own sync service carries that copy to the other devices signed in to the same browser account:

- On Chrome, Chrome Sync stores it with your Google account. It is encrypted in transit; with a sync passphrase set in Chrome, it is encrypted end to end.
- On Firefox, Firefox Sync stores it with your Mozilla account, encrypted end to end.

The extension itself still sends nothing anywhere, and the developer never receives the synced data. What syncs is the rules you added to the Default list and the settings that control cleaning. The Private list, Firefox container lists, the automatic-cleaning switch, the activity log, and the statistics never sync. Turning sync off stops this device from syncing; the copy in your browser account stays for your other devices until you remove it with your browser's own controls for synced data.

## What the extension stores, locally only

The extension keeps its own working data in your browser's local extension storage on your device:

- Your settings and your keep lists (the sites whose data you chose to preserve).
- An optional activity log and cleanup statistics, if you leave those features enabled; both can be disabled and cleared in the settings.
- Small per-session working state (for example, which cleanup is scheduled) that lets the background worker resume after the browser suspends it.

This data never leaves your device, unless you turn on optional sync (above), and it is removed by the browser when you uninstall the extension. The settings export feature writes a file only when you ask it to, to the location you choose, and the import feature only reads a file you explicitly select.

## What the extension deletes

Its job: cookies for sites you close, and — only for the data types you opt into — cache, IndexedDB, LocalStorage, plugin data, and service workers (on Chrome, Edge and Brave, Cache Storage goes with service workers and file-system storage with IndexedDB; Firefox gives extensions no way to delete those two for a single site, so on Firefox they stay until you clear the site's data in Firefox itself). That covers what a site stored on its other pages and in its frames on subdomains, not just its main address, and on Firefox also what frames from other sites (an embedded video player, say) stored inside its pages. Deletion happens entirely inside your browser through the browser's own extension APIs. The extension reads cookie metadata (domain, name, container) and the addresses of pages and frames as they load to decide what to delete and to show per-site counts; it does not read page content.

## Permissions Explained

| Permission                | Why the extension needs it                                                                                                                                                                                                                                                                                                                              |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cookies`                 | The core job: list and delete cookies for sites you close, and show the per-site cookie count.                                                                                                                                                                                                                                                          |
| `browsingData`            | Delete the other kinds of site data you opt into cleaning: cache, IndexedDB, LocalStorage, plugin data, service workers.                                                                                                                                                                                                                                |
| `storage`                 | Save your settings and keep lists locally; keep the small per-session working state that survives service-worker restarts; and, only if you turn on optional sync, keep a copy of the Default keep list and cleaning settings in the browser's sync storage.                                                                                            |
| `alarms`                  | Schedule the delayed automatic cleanup reliably under Manifest V3, where the background worker may be suspended while a delay is pending.                                                                                                                                                                                                               |
| `tabs`                    | Know which domains are open in tabs (so their data is kept), and react when a tab closes or changes domain.                                                                                                                                                                                                                                             |
| `activeTab`               | Act on the current tab for popup actions without needing anything broader at click time.                                                                                                                                                                                                                                                                |
| `scripting`               | Run the on-demand "wipe LocalStorage for this site" action inside the target tab, since MV3 removed inline script execution.                                                                                                                                                                                                                            |
| `contextMenus`            | The optional right-click menu (manual cleanups, add-to-list shortcuts). Can be turned off in settings.                                                                                                                                                                                                                                                  |
| `notifications`           | The optional "cleaned X sites" notifications. Can be turned off in settings.                                                                                                                                                                                                                                                                            |
| `webRequest`              | Notice the address of each page, and of each frame in it, as it loads, so data those parts of a site store is deleted with the site. Frames from the same site in every browser; on Firefox frames from other sites too, since Firefox deletes stored data host by host. Addresses only: it never reads content, and never blocks or changes a request. |
| Host access: `<all_urls>` | Cookies can belong to any site you visit, so reading and deleting them requires host access to all sites. The extension uses it exclusively for cookie/site-data cleanup — it does not read page content.                                                                                                                                               |

## Remote code

None. All code ships inside the extension package reviewed by the store; the extension never downloads, evaluates, or executes remote code.

## Changes and contact

This file is versioned with the source code, so every change to it is visible in the repository history; material changes are called out in the release notes. Questions or concerns: email <support@moakh.dev>, or, if you have a GitHub account, open an issue at <https://github.com/j127/auto_delete_cookies_for_privacy/issues>.
