# Settings Reference

Open the settings page from the **More controls…** link in the popup's footer, the right-click menu, or `brave://extensions` → ADCP → Details → Extension options. Settings apply immediately; there is no save button.

The settings live on the **Protection** page; the groups below match it top to bottom.

## Automatic Cleaning Options

**Enable Automatic Cleaning** — the master switch. Off means nothing is ever deleted automatically; the popup's manual actions still work. The popup's header tells you the current state ("Auto-delete is on" / "Auto-delete is off").

**Wait This Long Before Automatic Cleaning** — the delay (in seconds) between closing a site's last tab and the actual cleanup. Default 15. The delay is your undo window: reopen the site within it and nothing is removed. Minimum 1 second.

**Also Clean When a Tab Moves to a Different Domain** — normally cleanup triggers when a tab closes. With this on, navigating a tab from `siteA.com` to `siteB.com` also counts as leaving siteA. Stricter, but noticeable if you bounce between sites in one tab.

**Treat Discarded (Unloaded) Tabs as Closed** — browsers put background tabs to sleep to save memory. With this on, a site whose only tabs are asleep is treated as closed and becomes eligible for cleanup.

**Clean Greylist Entries When the Browser Restarts** — the switch that gives **Keep this session** its meaning (the label carries the internal list name). On restart, cookies belonging to session-kept sites are cleaned. See [Expressions and Lists](./expressions.md).

**On Startup, Also Clean Cookies and Site Data From Tabs That Reopen** — if your browser restores tabs on launch, those sites are normally protected (they're open, after all). Turn this on to clean them anyway, once, at startup.

**Always Remove Expired Cookies** — cookies past their expiry date are deleted during every cleanup pass, regardless of any list.

## Expression Options

**Create Default Options for This List** — creates a special `_Default:` expression per list. Whatever per-expression options you set on it (which site-data types to clean, whether to keep all cookies) become the starting options for every expression you add to that list afterwards. Edit it like any other expression.

## What gets deleted

One plain-language master switch — **Delete all site data** — covers the five non-cookie data types: **Cache**, **IndexedDB**, **LocalStorage**, **Plugin Data**, **Service Workers**. Flip it on and every type is cleaned in both automatic and manual cleanups, honoring your keep rules (an expression can also opt in/out per type — see [Expressions and Lists](./expressions.md)).

For finer control, open **Advanced — choose exactly what to delete** underneath: each type has its own switch there. A mixed selection shows the master switch half-set with a **Custom** badge.

Two things to know before flipping these:

- **Enabling a type wipes it once, everywhere.** The moment you switch one on, all currently stored data of that type is cleared for every site (that's the warning shown on the page). Turn off **When a New Data Type Is Enabled, Wipe What's Already Stored** first if you don't want that initial sweep.
- **Old data can't be selectively cleaned.** The browser only lets the extension clear these types per-site going forward, for sites you visit again. Leftovers from before you enabled the option stay until the site is visited once more.

## Extension Options

**Keep a Cleanup Log and Running Counter** — records every automatic cleanup (what was removed and why) and counts removed cookies. Nothing is logged for private/incognito tabs. The log stays on your machine.

**Show the Site's Cookie Count on the Toolbar Icon** — the badge number on the ADCP icon. Disabling this forces icon-color mode instead.

**Don't Recolor the Icon Based on List Matches** — keeps the default icon instead of the blue/yellow/red status coloring.

**Notify Me After Automatic Cleanups** / **Notify Me After Manual Cleanups** — system notifications summarizing what was just removed. **How Long Notifications Stay on Screen** controls their duration in seconds.

**Show advanced controls in the popup** — off by default. Reveals the popup's technical layer: exact-hostname rules (`mail.example.com` vs `*.example.com`), the matched-rule line, and the per-site delete actions under **More cleaning options**. The simple popup covers the common case; turn this on if you manage rules per hostname.

**Show a Popup After the Extension Updates** — opens the release notes once after each update.

**Add Entries to the Right-Click Menu** — the context menu with manual cleanup actions and add-to-list shortcuts. Turn it off if you like your right-click menu short.

**Popup size / Settings page size** — font size (in pixels) for the popup and settings pages. If buttons look enormous or cramped, adjust these.

**Debug Mode (Verbose Console Logging)** — makes the extension narrate its decisions to the service-worker console. Only useful when troubleshooting or filing a bug; leave it off otherwise.

## Maintenance buttons

At the bottom of the settings page:

- **Export / Import settings** — your settings as a JSON file (timestamped on export). Importing validates the file and rejects unknown settings.
- **Reset Settings to Defaults** — settings only; your saved sites are untouched.
- **Erase All Extension Data** — factory reset: settings, lists, log, counters. There is no undo.
