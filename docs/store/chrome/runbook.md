# Chrome Web Store release runbook

Step-by-step path from a tagged release to an updated Chrome Web Store listing. Written for someone with no repo context; every artifact referenced is produced by CI. The listing already exists (item id `ghnodpmkiilfdelcloblidoeecblgbfp`, linked from `extension/manifest.json`'s `homepage_url`), so this is the per-version update path — the listing copy and assets were set up once from [../listing.md](../listing.md) and persist between versions.

## 0. Prerequisites

- The maintainer's Google account, registered as a Chrome Web Store developer (the one-time registration behind the existing listing).
- A tagged release on GitHub: the draft created by the release workflow carries `*_Chrome.zip` (plus the Firefox and source zips, not used here). Publish the release or download from the draft; do not rebuild by hand.
- The manifest `version` in the zip must be strictly greater than the version currently live — guaranteed when the release came from a `release/X.Y.Z` branch that passed `just release_check`.

## 1. Upload the package

1. https://chrome.google.com/webstore/devconsole → select the item.
2. Package (left sidebar) → "Upload new package" → upload `Auto-Delete-Cookies-for-Privacy_<tag>_Chrome.zip`.
3. The dashboard parses the manifest and shows the new version number; fix nothing by hand in the zip — if something is wrong, fix it in the repo and cut a new tag.

## 2. Release notes

The CWS has no per-version release-notes field — there is nothing to paste at submit time. Users see what changed in-app (the settings Welcome page renders `src/ui/settings/release-notes.json`) and on the GitHub release. Only touch the listing's detailed description if its copy in [../listing.md](../listing.md) actually changed.

## 3. Listing and privacy checks (only if something changed)

- Store listing tab: copy and asset sources live in [../listing.md](../listing.md) (short/detailed description, screenshots, promo tiles).
- Privacy tab: single-purpose statement and per-permission justifications live in [../permissions.md](../permissions.md). These persist between versions; re-answer only if a permission was added or removed.
- A permission change triggers a deeper review and can disable the extension for users until they re-approve it — call it out in the PR that introduces it, and expect a slower review for that version.
- Unlike AMO, the CWS does not ask for source code.

## 4. Submit for review

- "Submit for review" from the item page. Leave deferred/staged publishing off unless there is a reason to hold the rollout — the default publishes automatically once the review passes.
- Review time is typically hours to a few days; MV3 extensions requesting `<all_urls>` host access routinely land at the slower end. Watch the developer-dashboard email for the verdict.
- If the reviewer requests changes or rejects: fix on a branch, merge to main per repo rules, tag a new patch release, and upload the new zip as a new version on the same item — never create a second listing.

## 5. After approval

- Verify the listing page shows the new version, and the screenshots/description still render correctly.
- Confirm the update propagates: on a machine with the extension installed, `chrome://extensions` → Developer mode → "Update", then check the version and that the Welcome page shows the new release notes.
- Spot-check the popup and settings pages against the screenshots in [../listing.md](../listing.md).
