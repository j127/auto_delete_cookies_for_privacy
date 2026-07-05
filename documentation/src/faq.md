# FAQ

## Why is automatic cleaning off when I install the extension?

Because deletion is permanent. A cookie cleaner that starts deleting the moment it's installed would log you out of everything before you had a chance to say which sites matter. Manual mode first, build your whitelist, then flip the switch — that's the intended order (see [Getting Started](./getting-started.md)).

## Why did I get logged out of a site?

In order of likelihood:

1. **The site isn't on a keep list** — or only its exact hostname is, while the login lives on a subdomain. Use the `*.example.com` form.
2. **It's on the greylist and the browser restarted.** Greylist survival ends at restart by design.
3. **A matching expression has "Keep All Cookies" off** and the login cookie's name isn't checked.
4. **The site's own cookie expired** — nothing to do with the extension.

Don't guess: turn on the [cleanup log](./cleanup-log.md) and read the decision line for that site. It names the exact rule that fired.

## What's the difference between the popup's cleaning buttons?

| Button                                                 | What it does                                                              |
| ------------------------------------------------------ | ------------------------------------------------------------------------- |
| Clean                                                  | Cleans everything eligible, but sites open in any tab are protected       |
| Clean, even open tabs                                  | Same, but open tabs don't protect their sites                             |
| Wipe cookies / LocalStorage / everything for this site | Immediate removal for the current site only — **ignores your keep lists** |

The wipe buttons are the "I mean it" tools: they skip every protection, including the whitelist, for the site you're looking at.

## How do I make ALL cookies disappear on browser restart?

Put the wildcard expression `*` on the **greylist**, enable **Clean Greylist Entries When the Browser Restarts**, and leave your genuinely permanent sites on the whitelist (the whitelist match wins for them). Every other site keeps its cookies during the session and loses them at restart.

## I enabled LocalStorage/cache cleanup — why is old data still there?

The browser only lets extensions clear those data types per-site for sites you visit. Data a site stored _before_ you enabled the option sits untouched until you visit that site once more; after that visit, cleanup can reach it. (Also check the one-time-wipe warning in [Settings](./settings.md#other-browsing-data-cleanup-options) — by default, enabling a type clears all existing data of that type once.)

## Cookies reappear immediately after cleaning — is it broken?

Almost always the site is still open in a tab (open sites re-create their cookies at will, and are protected anyway), or the site is being revisited by something — a pinned tab, an auto-refreshing page. Close the site's tabs and watch the cleanup log entry after the delay passes.

## Can I turn notifications off? Can I move them?

Off: yes — settings page, the two "Notify Me..." switches, or the bell toggle in the popup. Move them: no — where system notifications appear is decided by your operating system, not by extensions.

## Does it work in incognito/private windows?

Only if you allow it: `brave://extensions` → ADCP → **Allow in Incognito/Private**. Incognito cookies live in their own cookie store with their own expression lists, and private tabs are never written to the cleanup log.

## Why does the popup look too big / too small?

The popup and settings page have their own font-size settings (in pixels) under **Extension Options**. Default is 16; laptops with tight scaling often look better at 12–14.

## How do I reset everything?

Settings page, bottom: **Reset Settings to Defaults** (settings only, lists survive) or **Erase All Extension Data** (true factory reset — export your expressions first if in doubt, see [Import and Export](./import-export.md)).

## Does the extension phone home? Collect anything?

No. No server, no telemetry, no analytics, no third parties. Everything stays in your browser. Details per permission in the [Permissions](./permissions.md) chapter and the repository's PRIVACY.md.
