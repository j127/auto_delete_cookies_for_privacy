/**
 * @jest-environment jsdom
 */
/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 *
 * Firefox-flavored SiteDataControl specs (#529): Firefox can't clear a
 * site's cache, Cache Storage or file-system storage, so the switch's
 * description carries a note that says so and links to Brave.
 */
import * as React from "react";
import { render } from "@testing-library/react";
import { initialState } from "@/redux/state";

vi.stubGlobal("__BROWSER__", "firefox");
vi.resetModules();
const { default: SiteDataControl } =
  await import("@/ui/settings/components/SiteDataControl");

describe("SiteDataControl on Firefox", () => {
  beforeEach(() => {
    global.browser.i18n.getMessage.mockImplementation(
      (key: string, substitutions?: string[]) =>
        key === "siteDataCacheFirefoxNoteText"
          ? `${key} try ${substitutions?.[0] ?? ""} instead`
          : key
    );
  });

  it("appends the Firefox note, with a Brave link that opens in a new tab", () => {
    const { container } = render(
      <SiteDataControl
        settings={initialState.settings}
        onUpdateSetting={jest.fn()}
      />
    );
    const label = container.querySelector(
      'label[for="deleteAllSiteData"]'
    ) as HTMLLabelElement;
    expect(label.textContent).toContain(
      "deleteAllSiteDataDescText siteDataCacheFirefoxNoteText try Brave instead"
    );
    const links = container.querySelectorAll("a");
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute("href")).toBe("https://brave.com/");
    expect(links[0].getAttribute("target")).toBe("_blank");
  });
});
