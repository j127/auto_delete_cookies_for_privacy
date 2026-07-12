# AMO submission: permissions and data collection

Reviewer-facing justifications for every permission in the generated Firefox manifest, plus the data-collection declaration. Keep in sync with `PRIVACY.md`, `extension/manifest.json`, and `scripts/firefox_manifest.ts` (which adds the Firefox-only pieces). AMO has no per-permission dashboard fields like CWS; put the relevant lines in the "Notes for Reviewers" box (template in [runbook.md](runbook.md)) and keep this file as the source of truth.

## Host permission

### `<all_urls>`

> The extension deletes cookies and site data for whatever sites the user browses and then closes; it cannot know the set of sites in advance, so it needs cookie access across all hosts. It reads only cookie metadata and tab URLs — never page content — and makes no network requests of its own. If the user revokes site access in about:addons, the extension detects it, shows a warning instead of silently doing nothing, and offers a one-click re-grant prompt.

## API permissions

### `cookies`

> The core function: enumerate and delete cookies of closed sites (including cookies partitioned by Total Cookie Protection and cookies in First-Party-Isolation profiles), and show a per-site count in the popup and badge.

### `browsingData`

> When the user opts in, cleaned sites also lose their other stored data (IndexedDB, LocalStorage, service workers, plugin data) via browsingData.remove with hostname scoping. Cache is excluded on Firefox because Firefox cannot clear cache per site.

### `contextualIdentities`

> Container support: enumerate containers so every container's cookie store is cleaned (not just the ones with open tabs), show the active tab's container in the popup, offer per-container keep lists, and — when the user enables it — clean up the lists and cookies of a container the user deletes. Degrades gracefully when containers are disabled.

### `storage`

> Stores settings and keep lists locally (storage.local) and small per-session working state (storage.session) so the suspended event page can resume a pending cleanup and remember container names. Nothing is synced or transmitted.

### `alarms`

> Automatic cleanup runs after a user-configured delay; the alarms API is the supported way for a suspended event page to wake up and run the scheduled cleanup on time.

### `tabs`

> The extension must know which domains are open (their data is preserved) and react when a tab closes or changes domain — that is the trigger for automatic cleanup. Only tab URLs/domains and the tab's container id are inspected; page content is never read.

### `activeTab`

> Popup actions ("clean this site's data now") act on the site in the currently active tab at the moment the user clicks.

### `scripting`

> The optional "wipe LocalStorage for this site now" action executes a one-line storage-clearing call inside the target tab. No other scripts are injected, nothing runs automatically.

### `notifications`

> Optional, user-controlled notifications that report what a cleanup removed and surface cleanup errors. Off by default for automatic cleanups.

### `contextMenus`

> Optional right-click shortcuts for the same manual actions the popup offers (clean this site, add to keep list). The whole menu can be disabled in settings.

## Data collection declaration

The generated manifest declares:

```json
"browser_specific_settings": {
  "gecko": {
    "data_collection_permissions": { "required": ["none"] }
  }
}
```

Matching statement for the AMO data-collection section and reviewer notes:

> This extension collects and transmits no data of any kind: no personal data, no browsing history, no telemetry, no analytics, no crash reports. It makes no network requests. All processing happens locally; the only stored data is the user's own settings and keep lists in browser-local extension storage. This matches the manifest's `data_collection_permissions: { required: ["none"] }` declaration and the privacy policy (`PRIVACY.md`).
