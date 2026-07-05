# Getting Started

Fresh installs start in **manual mode**: nothing is deleted until you say so. This is deliberate — you get to build your keep lists first, so enabling automatic cleaning later doesn't log you out of everything you care about.

## Step 1: Whitelist the sites you want to keep

Think of the handful of sites where being logged out would annoy you: your email, your bank, the sites you pay for. For each one:

1. Visit the site.
2. Click the ADCP icon in the toolbar.
3. In the popup, use the **+ Whitelist** button to add the site's domain.

That's it. The popup offers two variants: the exact hostname (`mail.example.com`) or the domain with all its subdomains (`*.example.com`). When in doubt, pick the `*.` version — sites often spread their login across several subdomains.

You can also right-click any page or link and add it from the **Add to keep lists** context menu, or type expressions by hand on the settings page — see [Expressions and Lists](./expressions.md).

## Step 2: Decide what "clean" means for you

Out of the box, cleaning removes **cookies only**. If you want a site's other leftovers gone too (LocalStorage, cache, IndexedDB, service workers), turn those on in the settings page under **Other Browsing Data Cleanup Options**. Read the warnings there first — the moment you enable a type, all existing stored data of that type is wiped once, for every site.

## Step 3: Turn on automatic cleaning

Click the ADCP icon and flip the **Auto-clean** switch (or enable it on the settings page). From now on:

- Close a site's last tab, and after a short delay (15 seconds by default) its cookies are gone — unless the site is on a list or still open somewhere else.
- The toolbar icon shows how many cookies the current site has set, and its color tells you the site's status at a glance:
  - **Blue** — the site is on your whitelist
  - **Yellow** — the site is on your greylist
  - **Red** — the site matches no list, so it will be cleaned

## Step 4 (optional): Turn on the cleanup log

In settings, enable **Keep a Cleanup Log and Running Counter**. Every automatic cleanup then records which sites were cleaned and why, which is the single most useful tool when you're wondering "why did I get logged out of X?" — see [The Cleanup Log](./cleanup-log.md).

## Trying it out

A quick way to watch it work:

1. Visit a news site you don't log in to.
2. Note the cookie count on the ADCP icon.
3. Close the tab, wait ~20 seconds, and check the cleanup log (or the notification, if you enabled those).

The site's cookies are gone; your whitelisted sites are untouched. That's the whole loop — from here on it runs by itself.
