/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */
import * as React from "react";
import { CURRENT_BROWSER } from "@/services/browser-capabilities";
import type { BrowserTarget } from "@/services/browser-capabilities";
import Icon from "@/ui/common-components/Icon";

/**
 * The store listing each artifact points at. Keyed on build identity rather
 * than a browserCapabilities field: every capability there answers "what does
 * this browser's API support?", a question code asks before choosing a call
 * shape. This asks "which artifact am I?" — the identity is the whole reason,
 * so there is no capability to name. Record<BrowserTarget, ...> keeps the same
 * exhaustiveness guarantee: a new target won't type-check until its listing is
 * added here.
 *
 * The Firefox entry is the only AMO link the extension ships: the generated
 * Firefox manifest's homepage_url points at the repo instead, because AMO
 * rejects manifests whose homepage links back to an AMO listing. Sharing one is
 * fine — that is a "get this extension" link for another person. The AMO URL
 * carries no locale prefix so AMO can redirect each visitor to their own.
 */
const STORE_URLS: Record<BrowserTarget, string> = {
  chrome:
    "https://chromewebstore.google.com/detail/auto-delete-cookies-for-p/ghnodpmkiilfdelcloblidoeecblgbfp",
  firefox:
    "https://addons.mozilla.org/firefox/addon/autodelete-cookies-for-privacy/",
};

/**
 * The page the Share menu points at. Before publication this was the GitHub
 * repository, then the Chrome Web Store listing (issue #143); since the AMO
 * listing went live it is one per build target (issue #326), so the Firefox
 * build never asks users to share a link they cannot install from.
 */
export const EXTENSION_PAGE_URL = STORE_URLS[CURRENT_BROWSER];

/**
 * Quiet share dropdown in the popup's name bar (05d design). Two actions:
 * copy the extension-page link, or open a prefilled mail draft.
 */
const ShareMenu: React.FunctionComponent = () => {
  const [copied, setCopied] = React.useState(false);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(EXTENSION_PAGE_URL);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable: the mail action still works.
    }
  };

  const mailHref = `mailto:?subject=${encodeURIComponent(
    browser.i18n.getMessage("extensionName")
  )}&body=${encodeURIComponent(EXTENSION_PAGE_URL)}`;

  return (
    <details className="dropdown dropdown-end">
      <summary
        className="btn gap-1.5 btn-ghost font-semibold text-base-content/70 btn-xs"
        title={browser.i18n.getMessage("shareTooltipText")}
      >
        <Icon name="upload" size="sm" />
        {browser.i18n.getMessage("shareText")}
      </summary>
      <div className="dropdown-content z-10 mt-1 w-60 rounded-box border border-base-300 bg-base-100 p-1 shadow-lg">
        <button
          className="btn w-full justify-start gap-2 btn-ghost font-normal btn-sm"
          onClick={() => void copyLink()}
          type="button"
        >
          <Icon name="copy" size="sm" />
          {browser.i18n.getMessage(
            copied ? "shareCopiedText" : "shareCopyLinkText"
          )}
        </button>
        <a
          className="btn w-full justify-start gap-2 btn-ghost font-normal btn-sm"
          href={mailHref}
        >
          <Icon name="pen" size="sm" />
          {browser.i18n.getMessage("shareEmailText")}
        </a>
      </div>
    </details>
  );
};

export default ShareMenu;
