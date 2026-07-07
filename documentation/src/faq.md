# FAQ

## Why is automatic cleaning off when I install the extension?

Because deletion is permanent. A cookie cleaner that starts deleting the moment it's installed would log you out of everything before you had a chance to say which sites matter. Manual mode first, build your keep list, then flip the switch — that's the intended order (see [Getting Started](./getting-started.md)).

## Why did I get logged out of a site?

In order of likelihood:

1. **The site has no keep rule** — or only its exact hostname does, while the login lives on a subdomain. Use the `*.example.com` form.
2. **It's a Keep-this-session site and the browser restarted.** Session rules end at restart by design.
3. **A matching expression has "Keep All Cookies" off** and the login cookie's name isn't checked.
4. **The site's own cookie expired** — nothing to do with the extension.

Don't guess: turn on the [cleanup log](./cleanup-log.md) and read the decision line for that site. It names the exact rule that fired.

## What's the difference between the popup's cleaning actions?

| Action                             | What it does                                                              |
| ---------------------------------- | ------------------------------------------------------------------------- |
| Clean now                          | Cleans everything eligible, but sites open in any tab are protected       |
| Clean now, including open tabs     | Same, but open tabs don't protect their sites                             |
| Delete this site's cookies         | Immediate removal for the current site only — **ignores your keep rules** |
| Delete everything this site stored | The above plus cache, LocalStorage, databases, and workers for the site   |

Everything below "Clean now" lives under **More cleaning options**, which appears when **Advanced mode** is enabled in settings. The delete actions are the "I mean it" tools: they skip every protection, including your keep list, for the site you're looking at.

## How do I make ALL cookies disappear on browser restart?

Add the wildcard expression `*` as a **Keep this session** rule, enable **Session keep rules** (Advanced mode, Timing), and mark your genuinely permanent sites **Keep** — a Keep match wins for them. Every other site keeps its cookies during the session and loses them at restart.

## I enabled LocalStorage/cache cleanup — why is old data still there?

The browser only lets extensions clear those data types per-site for sites you visit. Data a site stored _before_ you enabled the option sits untouched until you visit that site once more; after that visit, cleanup can reach it. (Also check the one-time-wipe warning in [Settings](./settings.md#other-browsing-data-cleanup-options) — by default, enabling a type clears all existing data of that type once.)

## Cookies reappear immediately after cleaning — is it broken?

Almost always the site is still open in a tab (open sites re-create their cookies at will, and are protected anyway), or the site is being revisited by something — a pinned tab, an auto-refreshing page. Close the site's tabs and watch the cleanup log entry after the delay passes.

## Can I turn notifications off? Can I move them?

Off: yes — settings page, the two "Notify Me..." switches. Move them: no — where system notifications appear is decided by your operating system, not by extensions.

## Does it work in incognito/private windows?

Only if you allow it: `brave://extensions` → ADCP → **Allow in Incognito/Private**. Incognito cookies live in their own cookie store with their own saved sites, and private tabs are never written to the cleanup log.

## Why does the popup look too big / too small?

The popup and settings page have their own font-size settings (in pixels) under **Interface** with Advanced mode on. Default is 16; laptops with tight scaling often look better at 12–14. The popup's width is fixed — the sizes scale text only.

## How do I reset everything?

The **Import / Export** page has **Reset Settings to Defaults** (settings only, your saved sites survive). For a true factory reset, remove and reinstall the extension — export your saved sites first if in doubt, see [Import and Export](./import-export.md).

## Does the extension phone home? Collect anything?

No. No server, no telemetry, no analytics, no third parties. Everything stays in your browser. Details per permission in the [Permissions](./permissions.md) chapter and the repository's PRIVACY.md.
