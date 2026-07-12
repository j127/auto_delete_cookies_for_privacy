# Firefox UI verification notes

Verification pass for the browser-action surface, the popup, and the options page on the Firefox build (issue #288). Scope per the plan: fix concrete deviations only, no speculative restyling, and record accepted differences. The full interactive matrix (containers, private windows, FPI profile, permission revocation) lives in the Phase 6 manual test plan.

## Verified

- **Event page boots on real Firefox.** Headless `web-ext run` against `just build_firefox` output installs the artifact as a temporary add-on and starts the background event page with zero extension console errors (no `background.init failed`, no uncaught exceptions). The same smoke also passed during the tooling work in #295.
- **Badge/title/icon API surface.** Everything `browser-action-service.ts` calls exists on Firefox 128+: `action.setBadgeText`, `setBadgeBackgroundColor`, `setTitle`/`getTitle`, `setIcon`. `action.setBadgeTextColor` is Firefox-native (it is the Chrome side that historically lacked it) and was already presence-guarded, so both builds take their supported path. The title format (`<name> <version> [LIST] (count)`) is plain `setTitle` text and carries over unchanged.
- **Options page.** `options_ui.open_in_tab: true` is the same key on both browsers and the generated Firefox manifest carries it verbatim (single source of truth in the manifest transform); the settings page is a normal tab page with no popup-specific constraints.
- **`web-ext lint`** stays at 0 errors over the built artifact (gate in CI since #296).

## Popup sizing rationale

The popup pins `min-width: 430px` on the document element and scales fonts via the size setting. Firefox caps browser-action popups at 800×600 CSS pixels and otherwise sizes them from content — 430px wide fits, and the tall sections (expression table, site-data panel) already live inside their own `max-h-*` scroll containers, so the popup cannot exceed Firefox's height cap without scrolling internally. No code change needed.

## Accepted cosmetic differences

- Firefox renders the badge with its own font metrics and slightly different padding than Chromium; counts up to 4 digits still fit. Not actionable from extension code.
- The popup's outer corner radius and shadow are browser chrome and differ per platform theme.
- With `privacy.resistFingerprinting` enabled, Firefox may report a different device pixel ratio, making icons look marginally softer. Upstream had the same behavior; not actionable.
- The red `!` permission badge (from the revocation guard) uses Firefox's badge styling; on Chrome the same state cannot normally occur since host permissions are not one-click revocable there.

## Deviations fixed in this pass

- None required. The API audit found every call either cross-browser or already presence-guarded, and the boot smoke surfaced no runtime errors. (Concrete visual verification of the popup at default settings on a headed Firefox is part of the Phase 6 matrix, where a human eyeballs it once per release channel.)
