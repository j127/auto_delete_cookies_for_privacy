/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */
import * as React from "react";
import Icon from "@/ui/common-components/Icon";

/**
 * The page the Share menu points at. A single constant on purpose: until
 * the extension is published this is the GitHub repository, afterwards it
 * becomes the Chrome Web Store listing (tracked by issue #143).
 */
export const EXTENSION_PAGE_URL =
  "https://github.com/j127/auto_delete_cookies_for_privacy";

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
