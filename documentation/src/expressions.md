# Expressions and Lists

An **expression** is a pattern that matches site hostnames. Every expression lives on one of two lists, and together they decide what survives a cleanup.

## The two kinds of rules

**Keep** — matched sites are never cleaned. Your email, your bank, anything you always want to stay logged in to. The Saved sites table badges these **Kept**.

**Keep this session** — matched sites survive normal cleanups but are cleaned when the browser restarts (provided the restart-cleanup setting is on). Think "keep me logged in for this sitting": a shopping site you're comparing prices on all afternoon, but that shouldn't remember you next week. Badged **Until restart**.

> Under the hood these are the classic **whitelist** and **greylist** from the original project — `WHITE` and `GREY` in exported files and in the cleanup log's reasons. The UI just says what they do.

A site matching neither kind of rule is cleaned as soon as you leave it. That's the default fate; the rules are the exceptions.

If a hostname matches rules of both kinds, the first match found wins, so keep your patterns from overlapping when you can.

## Writing expressions

Add expressions from the popup (quickest), the right-click menu, or by typing them on the **Saved sites** page. That page shows each expression with its options and lets you edit or remove it.

| You type                         | It matches                                               |
| -------------------------------- | -------------------------------------------------------- |
| `example.com`                    | exactly `example.com` — not `mail.example.com`           |
| `*.example.com`                  | `example.com` and every subdomain (`mail.`, `www.`, ...) |
| `192.168.1.100`                  | that IP address                                          |
| `10.0.0.0/8`                     | any IP in that CIDR range                                |
| `/^(mail\|news)\.example\.com$/` | a regular expression — anything between the slashes      |
| `file:///home/user/notes`        | pages opened from that local folder                      |

Details worth knowing:

- Matching is on the **hostname only** — no `https://`, no paths. `www.` is ignored when reading the current site, so `example.com` and the site `www.example.com` line up the way you'd expect.
- Wrap a pattern in `/` ... `/` to use a regular expression. The settings page validates it and tells you if it can't be parsed.
- Commas are reserved for regular expressions; plain hostnames can't contain them (or spaces).
- Expressions live per cookie store: your normal browsing ("default") and incognito ("private") keep separate lists.

## Per-expression options

Every expression carries its own cleanup options — click it in the settings list to edit them:

**Keep All Cookies** — on by default. Switch it off and the expression shows the site's cookie names as checkboxes: checked names are kept, everything else is cleaned. This is how you keep a site's login cookie but drop its analytics ones.

**Site-data types** (Cache, IndexedDB, LocalStorage, Plugin Data, Service Workers) — per-type checkboxes controlling whether this expression's site data gets cleaned. A checked type means "clean this type for this site even though the site is on a keep list." Unchecked means the keep list protects that type too. These only matter for data types you've enabled globally in settings.

On a Keep-this-session rule, the same options read as "until restart": keep-all-cookies keeps them until the browser closes.

## Default options for new expressions

Create a `_Default:` expression for a list (button at the top of the settings page) and set its options; every expression added to that list afterwards starts with those options. Existing expressions are not changed.

## Order of protection

During a cleanup, a site's cookies are kept if **any** of these holds:

1. The site is still open in some tab (unless you chose a manual "include open tabs" clean).
2. It matches a **Keep** expression.
3. It matches a **Keep this session** expression and this isn't a restart cleanup.
4. The specific cookie's name is checked in a matching expression's cookie list.

Everything else goes. The [cleanup log](./cleanup-log.md) shows which rule fired for every decision, so you never have to guess.
