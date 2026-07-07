# Getting Started

Fresh installs start in **manual mode**: nothing is deleted until you say so. This is deliberate — you get to build your keep lists first, so enabling automatic cleaning later doesn't log you out of everything you care about.

## Step 1: Keep the sites you want to stay signed in to

Think of the handful of sites where being logged out would annoy you: your email, your bank, the sites you pay for. For each one:

1. Visit the site.
2. Click the ADCP icon in the toolbar.
3. In the popup, press **Keep cookies for this site**.

That's it — the rule covers the domain and all its subdomains (sites often spread their login across several), exactly as the caption under the button says. If you only want the site remembered until you close the browser, use **Keep until browser closes** instead.

Power users who want exact-hostname rules (`mail.example.com` vs `*.example.com`) can turn on **Advanced mode** on the settings page; the popup then offers a per-hostname row for each variant. You can also right-click any page or link and add it from the context menu, or type expressions by hand on the **Saved sites** page — see [Expressions and Lists](./expressions.md).

## Step 2: Decide what "clean" means for you

Out of the box, cleaning removes **cookies only**. If you want a site's other leftovers gone too (LocalStorage, cache, IndexedDB, service workers), flip the **Delete all site data** switch on the settings page under **What gets deleted** — or open **Advanced — choose exactly what to delete** below it to pick individual types. Read the warning there first — the moment you enable a type, all existing stored data of that type is wiped once, for every site.

## Step 3: Turn on automatic cleaning

On the settings page (**Protection**), flip **Clean automatically**. The popup's header now reads "Auto-delete is on" — and from now on:

- Close a site's last tab, and after a short delay (15 seconds by default) its cookies are gone — unless you keep the site or it's still open somewhere else.
- The toolbar icon shows how many cookies the current site has set, and its color tells you the site's status at a glance:
  - **Blue** — the site is kept permanently
  - **Yellow** — the site is kept for this session
  - **Red** — no keep rule matches, so it will be cleaned

## Step 4 (optional): Turn on the cleanup log

In settings, enable **Keep a cleanup log**. Every automatic cleanup then records which sites were cleaned and why, which is the single most useful tool when you're wondering "why did I get logged out of X?" — see [The Cleanup Log](./cleanup-log.md).

## Trying it out

A quick way to watch it work:

1. Visit a news site you don't log in to.
2. Note the cookie count on the ADCP icon.
3. Close the tab, wait ~20 seconds, and check the cleanup log (or the notification, if you enabled those).

The site's cookies are gone; your kept sites are untouched. That's the whole loop — from here on it runs by itself.
