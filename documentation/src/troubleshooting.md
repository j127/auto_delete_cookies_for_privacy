# Troubleshooting

## First stop: the cleanup log

Nine out of ten "why did it..." questions are answered by the [cleanup log](./cleanup-log.md). Enable it in settings, reproduce the situation, and read the decision line for the site in question. Every kept or cleaned cookie states its reason.

## Reading the extension's console

The extension's background logic runs in a **service worker**, and its console is where errors and debug output land:

1. Open `brave://extensions` (or `chrome://extensions`).
2. Make sure **Developer mode** is on.
3. On the ADCP card, click the **service worker** link under "Inspect views". A DevTools window opens.
4. Switch to the **Console** tab.

If the link says "service worker (inactive)", that's normal — the browser puts it to sleep between events. Click it anyway; inspecting wakes it.

## Debug mode

For a running commentary of every decision, enable **Debug Mode (Verbose Console Logging)** in settings, then watch the service-worker console. Every message is prefixed `ADCP_<version>`; paste that prefix into the console's filter box to hide everything else. Cookie values are masked in debug output.

## The icon isn't changing color / shows no number

- Colors only appear when **Don't Recolor the Icon Based on List Matches** is off.
- The number needs **Show the Site's Cookie Count on the Toolbar Icon** on.
- Color legend: **blue** = whitelisted, **yellow** = greylisted, **red** = no list matches (will be cleaned). With automatic cleaning off, the badge color carries the same meaning instead.

## Cleanup didn't run when I closed a tab

Checklist, in order:

1. Is automatic cleaning actually on? (Popup toggle.)
2. Was the site still open in another tab or window? Open sites are protected.
3. Did the delay pass? Default is 15 seconds after the last tab closes.
4. Is the site on a list? Whitelist survives everything; greylist survives until restart.
5. Was it a discarded (sleeping) tab? Those only count as closed if you enabled that setting.

The cleanup log shows which of these applied.

## Something looks broken — filing a useful bug report

Open an issue at <https://github.com/j127/auto_delete_cookies_for_privacy/issues> and include:

- Browser and version (e.g. Brave 1.61), and the ADCP version — the **About** tab of the settings page has a copyable debug block with exactly this.
- What you expected, what happened instead, and the steps to get there.
- Any errors from the service-worker console (see above).
- If it's a cleanup decision you disagree with: the matching cleanup-log entry and the relevant expression from your list.

Settings exports (see [Import and Export](./import-export.md)) contain no cookie data, so attaching one is safe and often speeds things up.
