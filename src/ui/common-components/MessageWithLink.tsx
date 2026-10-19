/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */
import * as React from "react";

/** A link that a message names through its one $1 placeholder. */
export interface MessageLink {
  href: string;
  /** The link text: a brand name, so it is the same in every language. */
  text: string;
}

/**
 * Brave, which the Firefox site-data note suggests for automatic cleanup
 * of what Firefox can't clear per site (#529): its cache, Cache Storage
 * and file-system storage.
 */
export const BRAVE_LINK: MessageLink = {
  href: "https://brave.com/",
  text: "Brave",
};

// Filled in for $1 and then split on, so the link lands where each
// translation puts it. A private-use character never occurs in a message.
const LINK_MARK = "";

interface OwnProps {
  messageKey: string;
  link: MessageLink;
}

/**
 * Renders a message whose $1 placeholder is a link, opened in a new tab.
 * A message without the placeholder renders as plain text.
 */
const MessageWithLink: React.FunctionComponent<OwnProps> = ({
  messageKey,
  link,
}) => {
  const [before, ...after] = browser.i18n
    .getMessage(messageKey, [LINK_MARK])
    .split(LINK_MARK);
  return (
    <>
      {before}
      {after.length > 0 && (
        <>
          <a
            className="link link-primary"
            href={link.href}
            rel="noopener noreferrer"
            target="_blank"
          >
            {link.text}
          </a>
          {after.join("")}
        </>
      )}
    </>
  );
};

export default MessageWithLink;
