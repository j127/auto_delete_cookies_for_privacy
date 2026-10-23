/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */

/**
 * Which "pin the extension" wording the Overview's activation card and the
 * Help page's getting-started list show (#536). Chrome pins through the
 * puzzle icon and the pin next to the extension. Desktop Firefox has an
 * Extensions button too, but pinning is a right-click on the extension and
 * "Pin to Toolbar". Firefox for Android runs the same Firefox build but has
 * no toolbar to pin to: the extension is opened from Firefox's menu under
 * Extensions. The build says Chrome or Firefox; the windows API tells the
 * two Firefoxes apart, the same runtime check #534 uses for Android.
 */

import {
  CURRENT_BROWSER,
  hasWindowsApi,
} from "@/services/browser-capabilities";

export interface PinStepKeys {
  /** Overview activation card, step 3. */
  setup: string;
  /** Help, getting started, item 4 ($pinStep$ in helpGettingStartedBody). */
  help: string;
}

export const pinStepKeys = (): PinStepKeys => {
  if (CURRENT_BROWSER === "chrome") {
    return { help: "helpPinStepText", setup: "setupStepPinText" };
  }
  if (hasWindowsApi()) {
    return { help: "helpPinStepFirefoxText", setup: "setupStepPinFirefoxText" };
  }
  return { help: "helpPinStepAndroidText", setup: "setupStepMenuAndroidText" };
};
