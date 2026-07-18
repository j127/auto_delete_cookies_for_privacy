/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2017-2022 Kenny Do and CAD Team; fork changes (c) 2026 j127.
 * Licensed under MIT (see LICENSE).
 */
import { readFileSync } from "fs";

import {
  buildFirefoxManifest,
  ChromeManifest,
  FIREFOX_ADDON_ID,
  FIREFOX_HOMEPAGE_URL,
  FIREFOX_STRICT_MIN_VERSION,
  serializeManifest,
} from "../../scripts/firefox_manifest";

/**
 * Minimal Chrome-shaped fixture. The suite also runs the transform against
 * the real committed manifest below, so this only needs the keys the
 * transform touches plus a few pass-through witnesses.
 */
const chromeFixture = (): ChromeManifest => ({
  manifest_version: 3,
  name: "Auto-Delete Cookies for Privacy",
  version: "1.0.0",
  homepage_url:
    "https://chromewebstore.google.com/detail/auto-delete-cookies-for-p/ghnodpmkiilfdelcloblidoeecblgbfp",
  minimum_chrome_version: "120",
  icons: { "48": "icons/icon_48.png" },
  background: { service_worker: "bundles/background.js", type: "module" },
  action: { default_popup: "popup/popup.html" },
  options_ui: { page: "settings/settings.html", open_in_tab: true },
  permissions: ["alarms", "cookies", "storage"],
  host_permissions: ["<all_urls>"],
});

describe("buildFirefoxManifest", () => {
  it("converts the service-worker background into an ESM event page", () => {
    const result = buildFirefoxManifest(chromeFixture());
    expect(result.background).toEqual({
      scripts: ["bundles/background.js"],
      type: "module",
    });
    expect(result.background).not.toHaveProperty("service_worker");
  });

  it("omits background.type when the chrome manifest has none", () => {
    const input = chromeFixture();
    input.background = { service_worker: "bundles/background.js" };
    const result = buildFirefoxManifest(input);
    expect(result.background).toEqual({ scripts: ["bundles/background.js"] });
  });

  it("drops the Chrome-only minimum_chrome_version key", () => {
    const result = buildFirefoxManifest(chromeFixture());
    expect(result).not.toHaveProperty("minimum_chrome_version");
  });

  it("retargets homepage_url away from the Chrome Web Store", () => {
    const input = chromeFixture();
    const result = buildFirefoxManifest(input);
    expect(result.homepage_url).toBe(FIREFOX_HOMEPAGE_URL);
    // The witness: a Chrome value was there and got replaced, not merely
    // defaulted in because the key was absent.
    expect(input.homepage_url).toContain("chromewebstore.google.com");
    expect(result.homepage_url).not.toContain("chromewebstore");
  });

  it("never points homepage_url at AMO, which AMO itself rejects", () => {
    // web-ext lint fails with RESTRICTED_HOMEPAGE_URL ("links directing to
    // addons.mozilla.org are not allowed to be used for homepage") — AMO links
    // its own listing, so the key is for the add-on's real homepage. Asserted
    // here so the fast suite catches it; otherwise only `just lint_firefox`
    // does, at submission time. The popup Share menu is the place that does
    // link AMO (see ShareMenu-firefox.spec.tsx).
    expect(FIREFOX_HOMEPAGE_URL).not.toContain("addons.mozilla.org");
    expect(buildFirefoxManifest(chromeFixture()).homepage_url).not.toContain(
      "addons.mozilla.org"
    );
  });

  it("adds contextualIdentities and keeps permissions sorted", () => {
    const result = buildFirefoxManifest(chromeFixture());
    expect(result.permissions).toEqual([
      "alarms",
      "contextualIdentities",
      "cookies",
      "storage",
    ]);
  });

  it("does not duplicate contextualIdentities if already present", () => {
    const input = chromeFixture();
    input.permissions = ["contextualIdentities", "cookies"];
    const result = buildFirefoxManifest(input);
    expect(result.permissions).toEqual(["contextualIdentities", "cookies"]);
  });

  it("sets the exact gecko settings AMO requires", () => {
    const result = buildFirefoxManifest(chromeFixture());
    expect(result.browser_specific_settings).toEqual({
      gecko: {
        id: FIREFOX_ADDON_ID,
        strict_min_version: FIREFOX_STRICT_MIN_VERSION,
        data_collection_permissions: { required: ["none"] },
      },
    });
    // The id must be GUID-shaped; AMO rejects bare names.
    expect(FIREFOX_ADDON_ID).toMatch(/^\{[0-9a-f-]{36}\}$/);
  });

  it("passes shared fields through unchanged", () => {
    const input = chromeFixture();
    const result = buildFirefoxManifest(input);
    // homepage_url is deliberately absent from this list: it is a transformed
    // field, not a pass-through one (see the AMO retarget test above). It does
    // appear in the fixture, which makes it easy to add here by mistake.
    for (const key of [
      "manifest_version",
      "name",
      "version",
      "icons",
      "action",
      "options_ui",
      "host_permissions",
    ]) {
      expect(result[key]).toEqual(input[key]);
    }
  });

  it("does not mutate its input", () => {
    const input = chromeFixture();
    const snapshot = structuredClone(input);
    buildFirefoxManifest(input);
    expect(input).toEqual(snapshot);
  });

  it("throws when background.service_worker is missing", () => {
    const input = chromeFixture();
    delete input.background;
    expect(() => buildFirefoxManifest(input)).toThrow(
      /background\.service_worker/
    );
  });

  it("throws when the permissions array is missing", () => {
    const input = chromeFixture();
    delete input.permissions;
    expect(() => buildFirefoxManifest(input)).toThrow(/permissions/);
  });
});

describe("buildFirefoxManifest with the committed manifest", () => {
  const chromeManifest: ChromeManifest = JSON.parse(
    readFileSync(new URL("../../extension/manifest.json", import.meta.url), {
      encoding: "utf8",
    })
  );

  it("produces a Firefox-loadable manifest from extension/manifest.json", () => {
    const result = buildFirefoxManifest(chromeManifest);
    expect(result.background.scripts).toEqual(["bundles/background.js"]);
    expect(result.background.type).toBe("module");
    expect(result).not.toHaveProperty("minimum_chrome_version");
    expect(result.browser_specific_settings.gecko.id).toBe(FIREFOX_ADDON_ID);
    // Every Chrome permission survives, plus the Firefox-only one.
    for (const permission of chromeManifest.permissions ?? []) {
      expect(result.permissions).toContain(permission);
    }
    expect(result.permissions).toContain("contextualIdentities");
    // The shipped Firefox artifact must not send users to a Chrome-only link.
    expect(result.homepage_url).toBe(FIREFOX_HOMEPAGE_URL);
    // ...while the Chrome manifest still points at the Chrome Web Store: the
    // Chrome artifact is unchanged by the AMO retarget (#326).
    expect(chromeManifest.homepage_url).toContain("chromewebstore.google.com");
    // Shared fields come straight from the single source of truth.
    expect(result.name).toBe(chromeManifest.name);
    expect(result.version).toBe(chromeManifest.version);
    expect(result.icons).toEqual(chromeManifest.icons);
    expect(result.action).toEqual(chromeManifest.action);
    expect(result.options_ui).toEqual(chromeManifest.options_ui);
    expect(result.host_permissions).toEqual(chromeManifest.host_permissions);
  });
});

describe("serializeManifest", () => {
  it("emits 2-space-indented JSON with a trailing newline", () => {
    const text = serializeManifest({ a: { b: 1 } });
    expect(text).toBe('{\n  "a": {\n    "b": 1\n  }\n}\n');
    expect(() => JSON.parse(text)).not.toThrow();
  });
});
