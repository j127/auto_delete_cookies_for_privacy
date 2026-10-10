# Chromium end-to-end tests

`just e2e_chromium` checks what site-data cleanup actually leaves behind in Chrome (#473). Chrome, Edge and Brave clean site data through `browsingData.remove` with `origins`, a different path from Firefox's `hostnames`, and #464 showed that a cleanup can look right in the log while storage survives. The suite reads the storage itself after the cleanup.

## What it checks

The fixture serves `www.adcp.test`, which sets its cookie on the parent domain and embeds a same-site `devicebind.adcp.test` frame, and `signin.adcp.test`, a page in a tab of its own that sets no cookie. Every one of these origins writes a localStorage entry, an IndexedDB database and a Cache Storage cache. After the tabs close and the cleanup runs, a plain-text page on each origin reads its storage back.

- `e2e/chromium/site_data.e2e.ts`, with the default site-data settings: the storage of the top-level host, of the same-site frame host (#464) and of the separate subdomain tab is empty, and the site's cookies are gone.
- `e2e/chromium/keep_rule.e2e.ts`: with the keep rule `*.adcp.test`, added through the store bridge as the popup adds it, all three origins keep their storage and the site keeps its cookies. A second site without a rule, `www.unkept.test`, closes last; its cookies and storage must be gone, which shows the cleanup ran.
- `e2e/chromium/scheme_bound.e2e.ts`: with Chrome's `EnableSchemeBoundCookies` feature on, as Edge can run, cookies without the Secure attribute that were set from an `https://` url (one host-only, one on the parent domain) must be gone after the cleanup. They used to be removed through an `http://` url, which no longer matches a cookie bound to https, so they and the extension's marker cookie stayed behind (#464).
- `e2e/chromium/same_name_keep.e2e.ts`: removing a cookie must not take a kept cookie with the same name. Chrome's `cookies.remove` deletes every same-name cookie the url would be sent, so the `https://` removal above only runs while the exact cookie is still stored. With the keep rule `adcp.test`, a non-Secure `sid` on `shop.adcp.test` must go and a Secure `sid` on `.adcp.test` must stay.

These are the Chromium end-state counterparts of rows 13 and 21 of the [Firefox test matrix](testing-firefox.md). Gecko leaves storage on port-carrying origins such as `localhost:PORT` alone, so the Firefox rows can only assert the cleanup log. Here `--host-resolver-rules` maps the fixture hostnames to the local server, so the origins carry no port and Chrome really clears them.

## How it works

- **Browser:** Chrome for Testing, because branded Chrome 137+ ignores `--load-extension`. The suite runs on the build pinned as `PINNED_CHROME_VERSION` in `e2e/helpers/chrome_cdp.ts`. Bump it deliberately, like the Firefox pins, after a green run on the new build.
- **Driver:** a small hand-written CDP client in `e2e/helpers/chrome_cdp.ts`, with no driver binary and no automation library. The extension's settings page is the probe: code evaluated there reads `chrome.cookies` and talks to the background store through the same store bridge as the UI.
- **Build:** the recipe runs `just build`, which writes the Chrome bundles into `extension/`, the folder `just package_zip` zips, and Chrome loads that folder unpacked.
- **Profile:** each spec file gets a fresh profile under the OS temp folder (`TMPDIR` moves it), removed when the file ends.
- **CI:** the `e2e-chromium` job in `.github/workflows/ci.yml` installs the pinned build with `@puppeteer/browsers`, prints its version, and runs `just e2e_chromium` on every pull request.

## Running it locally

1. Install the pinned build once: `bunx @puppeteer/browsers install chrome@<PINNED_CHROME_VERSION> --path ~/.cache/puppeteer`. The suite finds it there on macOS and Linux.
2. Run `just e2e_chromium`.

To run another Chrome for Testing build, point `CHROME_BIN` at its executable. `E2E_HEADED=1` shows the browser window.

To prove a new spec catches the bug it is about, break the behaviour in a local build and watch the spec fail, then restore it. For example, removing `cacheStorage` from Chrome's `extraRemovalTypes` in `src/services/browser-capabilities.ts` fails every "empties the storage" spec.
