# Settings Reference

> This book is the contributor/reference copy of the documentation. The extension ships its own user guide on the **Help** page of the settings, condensed from these chapters — the two are kept in step by hand.

Open the settings page from the **More controls…** link in the popup's footer, the right-click menu, or `brave://extensions` → ADCP → Details → Extension options. Settings apply immediately; there is no save button.

The settings live on the **Protection** page. The everyday view shows a handful of rows; flipping **Advanced mode** (the tinted row in the Interface card) reveals the expert rows inside their groups — and the popup's advanced controls, it's one global switch. Every row carries its own short description on the page, so this chapter only adds what doesn't fit there.

## Timing

**Clean automatically** — the master switch. Off means nothing is ever deleted automatically; the popup's manual actions still work. The popup's header tells you the current state ("Auto-delete is on" / "Auto-delete is off").

**Grace period** — the delay (in seconds) between closing a site's last tab and the actual cleanup. Default 15. The delay is your undo window: reopen the site within it and nothing is removed. Minimum 1 second.

**Clean when leaving a site** — normally cleanup triggers when a tab closes. With this on, navigating a tab from `siteA.com` to `siteB.com` also counts as leaving siteA. Stricter, but noticeable if you bounce between sites in one tab.

Advanced mode adds:

**Session keep rules** — the switch that gives **Keep until browser closes** its meaning. On restart, cookies belonging to session-kept sites are cleaned. See [Expressions and Lists](./expressions.md).

**Treat sleeping tabs as closed** — browsers put background tabs to sleep to save memory. With this on, a site whose only tabs are asleep is treated as closed and becomes eligible for cleanup.

**Clean restored tabs on startup** — if your browser restores tabs on launch, those sites are normally protected (they're open, after all). Turn this on to clean them anyway, once, at startup.

**Always remove expired cookies** — cookies past their expiry date are deleted during every cleanup pass, regardless of any list.

## What gets deleted

One plain-language master switch — **Delete all site data** — covers the five non-cookie data types: **Cache**, **IndexedDB**, **LocalStorage**, **Plugin Data**, **Service Workers**. Flip it on and every type is cleaned in both automatic and manual cleanups, honoring your keep rules (an expression can also opt in/out per type — see [Expressions and Lists](./expressions.md)).

For finer control, open **Advanced — choose exactly what to delete** underneath: each type has its own switch there. A mixed selection shows the master switch half-set with a **Custom** badge.

Two things to know before flipping these:

- **Enabling a type wipes it once, everywhere.** The moment you switch one on, all currently stored data of that type is cleared for every site (that's the warning shown on the page). Turn off the wipe-on-enable switch first if you don't want that initial sweep.
- **Old data can't be selectively cleaned.** The browser only lets the extension clear these types per-site going forward, for sites you visit again. Leftovers from before you enabled the option stay until the site is visited once more.

## Interface

**Notify after cleaning** — a system notification summarizing what an automatic cleanup just removed.

**Cookie count on toolbar icon** — the badge number on the ADCP icon. Disabling this forces icon-color mode instead.

**Keep a cleanup log** — records every automatic cleanup (what was removed and why) and counts removed cookies. Nothing is logged for private/incognito tabs. The log stays on your machine.

**Advanced mode** — the tinted row and the single global gate: it reveals the expert rows on this page _and_ the popup's technical layer — exact-hostname rules (`mail.example.com` vs `*.example.com`), the matched-rule line, and the per-site delete actions under **More cleaning options**. Off by default; the simple view covers the common case.

Advanced mode adds:

**Keep the plain icon** — keeps the default icon instead of the blue/yellow/red status coloring.

**Notify after manual cleanups** and **Notification duration** — the manual-cleanup counterpart and how long notifications stay on screen, in seconds.

**Show release notes after updates** — opens the release notes once after each update. On by default.

**Popup font size / Settings font size** — font size (in pixels) for the popup and settings pages. If buttons look enormous or cramped, adjust these. The popup's width is fixed; the sizes scale text only.

**Right-click menu actions** — the context menu with manual cleanup actions and add-to-list shortcuts. Turn it off if you like your right-click menu short.

**Debug mode** — makes the extension narrate its decisions to the service-worker console. Only useful when troubleshooting or filing a bug; leave it off otherwise.

## The other pages

- **Overview** — the deleted-cookie counters and the release notes.
- **Saved sites** — your keep rules; see [Expressions and Lists](./expressions.md).
- **Cleanup Log** — see [The Cleanup Log](./cleanup-log.md).
- **Import / Export** — all backup and restore: settings export/import, saved-sites export/import, and **Reset Settings to Defaults** (settings only; your saved sites are untouched). See [Import and Export](./import-export.md).
- **Help** — the in-app user guide condensed from this book.
- **Support** — the version line, the bug-reports link, and the copyable debug-information blocks.
