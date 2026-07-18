/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2017-2022 Kenny Do and CAD Team; fork changes (c) 2026 j127.
 * Licensed under MIT (see LICENSE).
 */

/**
 * Derives the Firefox MV3 manifest from the Chrome manifest
 * (extension/manifest.json). The Chrome manifest stays the single source of
 * truth for every shared field (name, version, permissions base, icons,
 * action, options_ui, ...), so the two manifests cannot drift: the Firefox
 * one is regenerated on every `--target firefox` build.
 *
 * Firefox deltas (everything else passes through untouched):
 * - background: Firefox MV3 has no service-worker background; it runs an
 *   event page declared via `background.scripts`. `type: "module"` is kept
 *   (supported since Firefox 112), so the same ESM bundles load unchanged.
 * - minimum_chrome_version: dropped (Chrome-only key).
 * - homepage_url: retargeted from the Chrome Web Store listing to the repo, so
 *   about:addons does not send Firefox users to a store they cannot install
 *   from. Deliberately NOT the AMO listing: AMO's own validator rejects that
 *   (RESTRICTED_HOMEPAGE_URL, "links directing to addons.mozilla.org are not
 *   allowed to be used for homepage"), since AMO already links its listing
 *   itself. The repo URL is what docs/store/firefox/listing.md specifies.
 * - permissions: `contextualIdentities` added for container support
 *   (Firefox-only API; Chrome would reject the unknown permission, which is
 *   one of the reasons the two targets need separate manifests — the other
 *   is that a dual-key background needs Chrome >= 121 while this extension
 *   supports 120).
 * - browser_specific_settings.gecko: required for AMO. The id is a random
 *   GUID (deliberately carries no account or host name); strict_min_version
 *   128 is the last broadly update-capable ESR (every API used is available
 *   by Firefox 115); data_collection_permissions is mandatory for new AMO
 *   submissions since 2025-11 — this extension collects nothing.
 */

/** Stable AMO add-on id. Never change this once published. */
export const FIREFOX_ADDON_ID = "{18370def-5c02-46b5-bf90-2c8de7e67a87}";

export const FIREFOX_STRICT_MIN_VERSION = "128.0";

/**
 * What about:addons shows as the add-on's homepage. The repo rather than a
 * store listing, matching docs/store/firefox/listing.md ("Support site /
 * homepage: the GitHub repo URL") — and AMO forbids pointing homepage_url at
 * an addons.mozilla.org listing anyway (see the delta list above).
 *
 * Not to be confused with the popup Share menu's link
 * (src/ui/popup/components/ShareMenu.tsx), which does point Firefox users at
 * the AMO listing: that one is a "get this extension" link handed to another
 * person, where the store listing is exactly right.
 */
export const FIREFOX_HOMEPAGE_URL =
  "https://github.com/j127/auto_delete_cookies_for_privacy";

interface ChromeBackground {
  service_worker: string;
  type?: string;
}

interface FirefoxBackground {
  scripts: string[];
  type?: string;
}

interface GeckoSettings {
  id: string;
  strict_min_version: string;
  data_collection_permissions: { required: string[] };
}

/**
 * Only the keys the transform touches are typed; everything else rides along
 * through the index signature.
 */
export interface ChromeManifest {
  background?: Partial<ChromeBackground>;
  permissions?: string[];
  minimum_chrome_version?: string;
  homepage_url?: string;
  [key: string]: unknown;
}

export interface FirefoxManifest {
  background: FirefoxBackground;
  permissions: string[];
  homepage_url: string;
  browser_specific_settings: { gecko: GeckoSettings };
  [key: string]: unknown;
}

/**
 * Pure transform: Chrome manifest object in, Firefox manifest object out.
 * The input is not mutated. Throws when the input is missing the pieces the
 * transform rewrites, so a future manifest reshape fails the build loudly
 * instead of emitting a broken Firefox artifact.
 */
export function buildFirefoxManifest(
  chromeManifest: ChromeManifest
): FirefoxManifest {
  const serviceWorker = chromeManifest.background?.service_worker;
  if (typeof serviceWorker !== "string") {
    throw new Error(
      "chrome manifest has no background.service_worker; " +
        "firefox manifest generation needs updating"
    );
  }
  if (!Array.isArray(chromeManifest.permissions)) {
    throw new Error(
      "chrome manifest has no permissions array; " +
        "firefox manifest generation needs updating"
    );
  }

  // Mutating a clone (instead of destructure-and-rebuild) keeps background
  // and permissions in their original key positions, so the generated file
  // diffs cleanly against the Chrome manifest.
  const manifest = structuredClone(chromeManifest) as FirefoxManifest;

  delete manifest.minimum_chrome_version;

  // Assigning (rather than deleting and re-adding) overwrites the key in
  // place, so it keeps its original position too.
  manifest.homepage_url = FIREFOX_HOMEPAGE_URL;

  const background: FirefoxBackground = { scripts: [serviceWorker] };
  const backgroundType = chromeManifest.background?.type;
  if (backgroundType !== undefined) background.type = backgroundType;
  manifest.background = background;

  manifest.permissions = [
    ...new Set([...chromeManifest.permissions, "contextualIdentities"]),
  ].sort();

  manifest.browser_specific_settings = {
    gecko: {
      id: FIREFOX_ADDON_ID,
      strict_min_version: FIREFOX_STRICT_MIN_VERSION,
      data_collection_permissions: { required: ["none"] },
    },
  };

  return manifest;
}

/** Matches the formatting of the committed manifest: 2-space indent, LF. */
export function serializeManifest(manifest: object): string {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}
