# Installation

ADCP runs on Chromium-based browsers: Google Chrome, Brave, Chromium, and others built on the same engine (version 120 or newer). It is a Manifest V3 extension, so it works on current browsers without any deprecation warnings.

> **Not yet on the Chrome Web Store.** The 4.0.0 store release is in preparation. Until it lands, you install the extension manually — it takes about two minutes.

## Installing from source

1. **Get the code.** Either clone the repository with git, or download it as a ZIP from GitHub and unpack it.

2. **Build it.** You need [Bun](https://bun.sh) and [just](https://github.com/casey/just) installed. From the project folder:

   ```bash
   just install
   just build
   ```

   This produces the ready-to-load extension in the `extension/` folder.

3. **Load it into the browser.**
   - Open `brave://extensions` (Brave) or `chrome://extensions` (Chrome/Chromium).
   - Turn on **Developer mode** (toggle in the top-right corner).
   - Click **Load unpacked** and select the project's `extension/` folder.

4. **Pin it.** Click the puzzle-piece icon in the toolbar and pin ADCP so its icon (and cookie counter) stays visible.

## Updating a manual install

Pull the latest code, run `just build` again, then hit the reload arrow on the extension's card in `brave://extensions`.

## Incognito / private windows

By default the extension doesn't run in incognito windows. If you want it to clean those too, open the extension's card in `brave://extensions` and enable **Allow in Incognito** (Chrome) / **Allow in Private** (Brave). Nothing from private windows is ever written to the cleanup log either way.

## Coming from another cookie manager?

If you used a similar extension before, export your keep lists from it (most can export a JSON file) and check [Import and Export](./import-export.md) — ADCP's expression format is documented there, and small edits are usually enough to bring a list across.
