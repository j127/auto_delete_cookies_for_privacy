# Chrome Web Store submission: single purpose, permissions, data disclosures

Paste-ready text for the CWS developer dashboard ("Privacy practices" tab). Keep answers in sync with `PRIVACY.md` and `extension/manifest.json`.

## Single purpose description

> Automatically deletes cookies and other site data left behind by sites you close (with a configurable delay and per-site keep lists), and provides the same cleanup on demand.

## Permission justifications

The dashboard asks for a justification per permission, one field at a time.

### `cookies`

> The extension's core function is to enumerate and delete cookies that belong to sites the user has closed, and to show a per-site cookie count on the toolbar badge and in the popup. This is impossible without the cookies API.

### `browsingData`

> When the user opts in, the extension also clears other site data for cleaned sites (cache, IndexedDB, LocalStorage, plugin data, service workers). browsingData.remove with origin scoping is the only API that removes these data types.

### `storage`

> Stores the user's settings and keep lists locally (storage.local) and small per-session working state (storage.session) so a suspended Manifest V3 service worker can resume a pending cleanup. Nothing is synced or transmitted.

### `alarms`

> Automatic cleanup runs after a user-configured delay. Under Manifest V3 the service worker can be suspended before the delay elapses; the alarms API is the supported way to be woken up to run the scheduled cleanup on time.

### `tabs`

> The extension must know which domains are currently open so their data is preserved, and must react when a tab closes or navigates to a different domain — that event is what triggers the automatic cleanup decision. Only tab URLs/domains are inspected; page content is never read.

### `activeTab`

> Popup actions ("clean this site's data now", "wipe LocalStorage for this site") act on the site in the currently active tab at the moment the user clicks.

### `scripting`

> The optional "wipe LocalStorage for this site now" action executes a one-line storage-clearing call inside the target tab. Manifest V3 removed inline script execution, so scripting.executeScript is the only way to run it. No other scripts are injected.

### `contextMenus`

> Provides the optional right-click menu with manual cleanup shortcuts and "keep this site" list actions. The menu can be disabled in the extension's settings.

### `notifications`

> Shows the optional "cleaned N sites" summary and error notifications after cleanups. Notifications can be disabled in the extension's settings.

### Host permission `<all_urls>`

> Cookies and site data can belong to any site the user visits, so cleaning them requires host access to all sites; a fixed host list would silently break the extension's single purpose. Host access is used exclusively to read cookie metadata and delete cookies/site data — the extension never reads or modifies page content, and it makes no network requests.

## Data usage disclosures

Dashboard checklist ("What user data do you plan to collect?"): check **none** of the categories.

| Category                                        | Collected? |
| ----------------------------------------------- | ---------- |
| Personally identifiable information             | No         |
| Health information                              | No         |
| Financial and payment information               | No         |
| Authentication information                      | No         |
| Personal communications                         | No         |
| Location                                        | No         |
| Web history                                     | No         |
| User activity (clicks, mouse position, logging) | No         |
| Website content                                 | No         |

Certifications to affirm, truthfully:

- Data is **not** sold to third parties.
- Data is **not** used or transferred for purposes unrelated to the item's single purpose.
- Data is **not** used or transferred to determine creditworthiness or for lending purposes.

Privacy policy URL field: the public URL of `PRIVACY.md` (repo goes public before submission; the GitHub blob URL is sufficient).

## Review-risk note

The `<all_urls>` + `cookies` combination routinely triggers in-depth review. The mitigations are already in place: no remote code, no network requests, all processing local, and the justifications above explain why narrower host access cannot work. Expect a slower first review rather than a rejection.
