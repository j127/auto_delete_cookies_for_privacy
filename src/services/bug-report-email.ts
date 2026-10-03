/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */

/**
 * The Support page's "Email a bug report" link (#436): a mailto: URL whose
 * subject and body are already filled in with the page's two copy blocks,
 * so people without a GitHub account can still report a problem. The
 * person's own mail app sends the message; the extension sends nothing.
 *
 * Some mail clients cut a mailto: URL at about 2,000 characters, so the
 * URL is kept within MAILTO_MAX_LENGTH, measured after encoding. The system
 * details are always kept whole. When everything doesn't fit, the settings
 * block is left out first and the body says so; only if that still doesn't
 * fit is the opening prompt dropped as well.
 */

export const SUPPORT_EMAIL = "support@moakh.dev";

/** Measured on the whole encoded URL, "mailto:" included. */
export const MAILTO_MAX_LENGTH = 2000;

export interface BugReportEmailParts {
  /** The subject line, already localized. */
  subject: string;
  /** The opening question the reporter answers, already localized. */
  prompt: string;
  /** The Support page's first copy block. */
  systemDetails: string;
  /** The Support page's second copy block. */
  settings: string;
  /** Says the settings were left out, already localized. */
  settingsLeftOutNote: string;
}

export interface BugReportEmail {
  href: string;
  /** False when the settings block didn't fit and was left out. */
  includesSettings: boolean;
}

// RFC 6068: line breaks in a mailto: body are written as CRLF.
const CRLF = "\r\n";

const toHref = (subject: string, body: string): string =>
  `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
    subject
  )}&body=${encodeURIComponent(body.split("\n").join(CRLF))}`;

const section = (title: string, text: string): string => `${title}:\n${text}`;

export const buildBugReportEmail = (
  parts: BugReportEmailParts
): BugReportEmail => {
  const system = section("System details", parts.systemDetails);
  // Blank lines under the prompt leave room to type the answer.
  const opening = `${parts.prompt}\n\n\n\n`;
  const candidates: BugReportEmail[] = [
    {
      href: toHref(
        parts.subject,
        `${opening}${system}\n\n${section("Settings", parts.settings)}`
      ),
      includesSettings: true,
    },
    {
      href: toHref(
        parts.subject,
        `${opening}${system}\n\n${parts.settingsLeftOutNote}`
      ),
      includesSettings: false,
    },
    {
      href: toHref(parts.subject, `${system}\n\n${parts.settingsLeftOutNote}`),
      includesSettings: false,
    },
  ];
  return (
    candidates.find(
      (candidate) => candidate.href.length <= MAILTO_MAX_LENGTH
    ) ?? candidates[candidates.length - 1]
  );
};
