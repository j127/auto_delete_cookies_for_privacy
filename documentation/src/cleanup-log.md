# The Cleanup Log

The cleanup log answers the two questions every cookie cleaner eventually raises: _"why did I get logged out of that site?"_ and _"is this thing actually doing anything?"_

Enable it in settings (**Keep a cleanup log**), then open the **Cleanup Log** tab on the settings page.

## Reading an entry

Each automatic cleanup that removed something creates one entry, stamped with the time it ran. Expand an entry and you'll see the affected sites grouped by cookie store, and for each site the decision that was made, in plain words:

- **Kept: matched _expression_ on the _list_** — a keep-list rule protected it.
- **Kept: \*._domain_ is still open in a tab** — open sites are never cleaned (unless you asked for an include-open-tabs manual clean).
- **Cleaned: _site_ appears on neither the Whitelist nor the Greylist** — the default fate.
- **Cleaned at startup: ...** — the browser-restart cleanup, which is what empties Keep-this-session sites.
- **Cleaned selectively: ...** — an expression matched, but this particular cookie's name wasn't on its keep list.
- **Removed only expired cookies from _site_** — the expired-cookie setting at work.
- **Internal marker cookie removed ...** — bookkeeping for site-data cleanup; not one of your cookies.

The decision lines use the internal list names: **Whitelist**/`WHITE` is a permanent **Keep** rule, **Greylist**/`GREY` is **Keep this session** (see [Expressions and Lists](./expressions.md)).

If other site data (cache, LocalStorage, ...) was cleaned, the entry lists which types were cleared for which domains.

Use the filter box to find a specific site in a long entry, and the per-entry remove button (or **Clear Logs**) to prune history.

## What the log is not

- It is **not sent anywhere** — it lives in your browser and dies with the extension's data.
- It **never contains cookie values**, only names, domains, and decisions.
- It **never records private/incognito tabs** at all.
- It is capped — old entries fall off the end; export nothing, worry about nothing.

## The counters

Next to the log, ADCP keeps two numbers: cookies removed **this browser session** and **in total** since installation. They show as the stat cards on the **Overview** page, and the reset button beside them resets both.

## A worked example

Say you read `news.example` (no keep rule), while `mail.example` (kept) sits in another tab:

1. You close the news tab. Fifteen seconds later a cleanup runs.
2. The log entry shows: `news.example` — _Cleaned: appears on neither the Whitelist nor the Greylist_; `mail.example` — _Kept: matched \*.mail.example on the WHITE list_ (and it was open anyway).
3. The session counter goes up by however many cookies the news site had set.

If tomorrow you're logged out of a site you meant to keep, the log will show exactly which decision hit it — usually the fix is adding a `*.`-prefixed expression so subdomains are covered too.
