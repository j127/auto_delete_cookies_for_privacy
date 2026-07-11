# AMO first-submission runbook

Step-by-step path from a tagged release to a listed Firefox add-on. Written for someone with no repo context; every artifact referenced is produced by CI. Do not start until the manual Firefox test matrix (docs/testing-firefox.md) has a fully recorded pass — that is the branch's merge gate anyway.

## 0. Prerequisites

- A Firefox Account for the maintainer, registered on https://addons.mozilla.org (AMO) as a developer (free).
- A tagged release on GitHub: the draft created by the release workflow carries the three artifacts you need — `*_Firefox.zip`, `*_Source.zip` (and the Chrome zip, not used here). Publish or download from the draft; do not rebuild by hand.
- The add-on id `{18370def-5c02-46b5-bf90-2c8de7e67a87}` is baked into the manifest; AMO binds it to the listing at first upload. Never change it afterwards.

## 1. Channel choice

Choose **Listed** on the first upload page ("On this site"). Listed means AMO hosts, signs, reviews, and auto-updates the add-on — right for a general-audience privacy tool. (Unlisted/self-distributed would mean hosting update infrastructure ourselves; only reconsider if the listing is ever rejected on policy grounds.)

## 2. Upload the add-on

1. https://addons.mozilla.org/developers/ → "Submit a New Add-on" → "On this site".
2. Upload `Auto-Delete-Cookies-for-Privacy_<tag>_Firefox.zip`. The validator runs the same linter as `just lint_firefox`; expect 0 errors and the two known warnings (the `data_collection_permissions` key is newer than the declared minimum Firefox version — required by AMO policy regardless — and innerHTML notices from the React vendor chunk).
3. "Do You Need to Submit Source Code?" → **Yes** (the bundles are built from TypeScript).

## 3. Upload the source package

1. Upload `Auto-Delete-Cookies-for-Privacy_<tag>_Source.zip` from the same release.
2. The build instructions reviewers need are inside it at `README-BUILD.md` (pinned Bun version from `.bun-version`, `bun install --frozen-lockfile`, `bun run scripts/build.ts --target firefox`). CI's `reproducible-firefox` job proves the rebuild is content-identical on every push, so the reviewer's rebuild will match.

## 4. Describe the add-on

- Fill the listing fields from [listing.md](listing.md) (name, summary, description, category Privacy & Security, license MIT, homepage/support = the GitHub repo).
- Paste `PRIVACY.md` into the privacy-policy field.
- Data collection section: declare **no data collected/transmitted**, consistent with the manifest's `data_collection_permissions: { required: ["none"] }` (statement text in [permissions.md](permissions.md)).

## 5. Notes for Reviewers (paste template)

> Auto-Delete Cookies for Privacy deletes cookies/site data of closed tabs; it collects nothing and makes no network requests.
>
> BUILD: the source zip contains README-BUILD.md. Toolchain is Bun (version pinned in .bun-version); `bun install --frozen-lockfile` then `bun run scripts/build.ts --target firefox` reproduces `builds/firefox/` byte-for-byte against the submitted xpi contents (bundles ship unminified on purpose; our CI re-verifies reproducibility on every push).
>
> PERMISSIONS: host access `<all_urls>` is required because the extension cleans cookies for whatever sites the user closes; per-permission justifications: [paste the relevant lines from permissions.md].
>
> The extension is a maintained, MV3 successor to the archived Cookie AutoDelete (same MIT license, credited in every file header).

## 6. Review and replies

- First listed review commonly takes from a day to a few weeks; watch the email tied to the Firefox Account and the developer hub message center, and answer reviewer questions in the submission thread (replies re-queue the review, so answer completely in one message).
- If the reviewer requests changes: fix on a branch, merge to main per repo rules, tag a new patch release, and upload the new zip + source zip as a **new version** on the existing listing — never a new listing (the id binds them).

## 7. After approval

- Verify the listing page shows the right screenshots, policy, and localized summaries.
- Tag-driven releases continue to produce matched Firefox/source zips; each future version upload repeats steps 2–3 and 5 only (listing copy persists).
- Record the AMO listing URL in the repo README once live.
