/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2017-2022 Kenny Do and CAD Team; fork changes (c) 2026 j127.
 * Licensed under MIT (see LICENSE).
 */

import { browserName } from "../typings/enums";

/**
 * Replaces the old extension/global_files/browserDetect.js page script, which
 * relied on window/document and cannot run inside a Manifest V3 service
 * worker. UA sniffing is enough here: every Chromium browser (Chrome, Brave,
 * Edge, Opera) must take the Chrome code paths, and the Firefox branch is
 * kept only so those code paths survive for a potential future Firefox build.
 */
export default function browserDetect(): browserName {
  if (
    typeof navigator !== "undefined" &&
    navigator.userAgent.includes("Firefox")
  ) {
    return browserName.Firefox;
  }
  return browserName.Chrome;
}
