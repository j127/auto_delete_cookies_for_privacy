/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2017-2022 Kenny Do and CAD Team; fork changes (c) 2026 j127.
 * Licensed under MIT (see LICENSE).
 */

/**
 * First-Party Isolation probe (Firefox only). Whether FPI is on decides
 * how cookies.set must be called: under FPI a set WITHOUT firstPartyDomain
 * rejects, while with FPI off a set WITH a non-empty firstPartyDomain
 * rejects — so the marker-cookie writer has to know the state.
 *
 * There is no direct API for the pref. The probe exploits the getAll
 * contract instead: a getAll without a firstPartyDomain key rejects iff
 * FPI is enabled. The result is cached in storage.session — FPI flips
 * require a browser restart, so a session-lifetime cache is safe, and it
 * survives event-page suspends.
 */

import { browserCapabilities } from "./browser-capabilities";

export const FPI_SESSION_KEY = "fpiEnabled";

export const isFirstPartyIsolationOn = async (): Promise<boolean> => {
  if (!browserCapabilities.supportsFirstPartyDomain) return false;
  const cached = (await browser.storage.session.get(FPI_SESSION_KEY)) as
    Record<string, unknown> | undefined;
  const cachedValue = cached?.[FPI_SESSION_KEY];
  if (typeof cachedValue === "boolean") return cachedValue;

  let enabled = false;
  try {
    // The .invalid TLD guarantees a cheap, empty result when FPI is off.
    await browser.cookies.getAll({ domain: "fpi-probe.invalid" });
  } catch {
    enabled = true;
  }
  await browser.storage.session.set({ [FPI_SESSION_KEY]: enabled });
  return enabled;
};
