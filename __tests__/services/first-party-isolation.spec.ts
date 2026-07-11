/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2017-2022 Kenny Do and CAD Team; fork changes (c) 2026 j127.
 * Licensed under MIT (see LICENSE).
 */
import { when } from "jest-when";
import {
  FPI_SESSION_KEY,
  isFirstPartyIsolationOn,
} from "@/services/first-party-isolation";

describe("isFirstPartyIsolationOn() on Chrome (default flavor)", () => {
  it("returns false without touching any API", async () => {
    await expect(isFirstPartyIsolationOn()).resolves.toBe(false);
    expect(global.browser.cookies.getAll).not.toHaveBeenCalled();
    expect(global.browser.storage.session.get).not.toHaveBeenCalled();
    expect(global.browser.storage.session.set).not.toHaveBeenCalled();
  });
});

describe("isFirstPartyIsolationOn() on Firefox", () => {
  const importFirefoxFlavored = async () => {
    vi.stubGlobal("__BROWSER__", "firefox");
    vi.resetModules();
    return import("@/services/first-party-isolation");
  };

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("probes via getAll and caches false when FPI is off", async () => {
    const firefoxFlavored = await importFirefoxFlavored();
    when(global.browser.storage.session.get)
      .calledWith(FPI_SESSION_KEY)
      .mockResolvedValue({} as never);
    when(global.browser.cookies.getAll)
      .calledWith({ domain: "fpi-probe.invalid" })
      .mockResolvedValue([] as never);

    await expect(firefoxFlavored.isFirstPartyIsolationOn()).resolves.toBe(
      false
    );
    expect(global.browser.storage.session.set).toHaveBeenCalledWith({
      [FPI_SESSION_KEY]: false,
    });
  });

  it("interprets the probe rejection as FPI on and caches true", async () => {
    const firefoxFlavored = await importFirefoxFlavored();
    when(global.browser.storage.session.get)
      .calledWith(FPI_SESSION_KEY)
      .mockResolvedValue({} as never);
    when(global.browser.cookies.getAll)
      .calledWith({ domain: "fpi-probe.invalid" })
      .mockRejectedValue(
        new Error(
          "First-Party Isolation is enabled, but the required 'firstPartyDomain' attribute was not set."
        ) as never
      );

    await expect(firefoxFlavored.isFirstPartyIsolationOn()).resolves.toBe(true);
    expect(global.browser.storage.session.set).toHaveBeenCalledWith({
      [FPI_SESSION_KEY]: true,
    });
  });

  it("short-circuits on the session cache without re-probing", async () => {
    const firefoxFlavored = await importFirefoxFlavored();
    when(global.browser.storage.session.get)
      .calledWith(FPI_SESSION_KEY)
      .mockResolvedValue({ [FPI_SESSION_KEY]: true } as never);

    await expect(firefoxFlavored.isFirstPartyIsolationOn()).resolves.toBe(true);
    expect(global.browser.cookies.getAll).not.toHaveBeenCalled();
    expect(global.browser.storage.session.set).not.toHaveBeenCalled();
  });
});
