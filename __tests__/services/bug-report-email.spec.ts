/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */
import { readdirSync, readFileSync } from "fs";
import { initialState } from "@/redux/state";
import {
  buildBugReportEmail,
  BugReportEmailParts,
  MAILTO_MAX_LENGTH,
  SUPPORT_EMAIL,
} from "@/services/bug-report-email";
import { formatSystemDetails } from "@/services/system-details";

const LOCALES_ROOT = new URL("../../extension/_locales/", import.meta.url);

type Messages = Record<string, { message: string }>;
const readLocale = (locale: string): Messages =>
  JSON.parse(
    readFileSync(new URL(`${locale}/messages.json`, LOCALES_ROOT), "utf8")
  ) as Messages;

// A long but realistic system block: the full Chromium version, a
// versioned OS with its arch, and the full product name.
const SYSTEM_DETAILS = formatSystemDetails(
  {
    browser: "Microsoft Edge 130.0.2849.68",
    os: "Windows 11 (x86-64)",
  },
  "Auto-Delete Cookies for Privacy",
  "1.2.0"
);

// The settings block exactly as the Support page builds it from defaults.
const DEFAULT_SETTINGS = Object.values(initialState.settings)
  .map((setting) => `- ${setting.name}: ${setting.value}`)
  .join("\n");

const partsFor = (
  messages: Messages,
  overrides: Partial<BugReportEmailParts> = {}
): BugReportEmailParts => ({
  subject: `${messages.emailSubjectText.message}: Auto-Delete Cookies for Privacy 1.2.0`,
  prompt: messages.emailBodyPromptText.message,
  systemDetails: SYSTEM_DETAILS,
  settings: DEFAULT_SETTINGS,
  settingsLeftOutNote: messages.emailSettingsLeftOutText.message,
  ...overrides,
});

const decode = (href: string) => {
  const url = new URL(href);
  return {
    protocol: url.protocol,
    to: url.pathname,
    subject: url.searchParams.get("subject"),
    body: url.searchParams.get("body") ?? "",
  };
};

const EN = readLocale("en");

describe("buildBugReportEmail", () => {
  it("addresses the support mailbox with the subject and both blocks", () => {
    const email = buildBugReportEmail(partsFor(EN));
    const { protocol, to, subject, body } = decode(email.href);
    expect(protocol).toBe("mailto:");
    expect(to).toBe(SUPPORT_EMAIL);
    expect(subject).toBe("Bug report: Auto-Delete Cookies for Privacy 1.2.0");
    expect(email.includesSettings).toBe(true);
    const lines = body.split("\r\n");
    expect(lines[0]).toBe(EN.emailBodyPromptText.message);
    expect(body).toContain(
      `System details:\r\n${SYSTEM_DETAILS.split("\n").join("\r\n")}`
    );
    expect(body).toContain(
      `Settings:\r\n${DEFAULT_SETTINGS.split("\n").join("\r\n")}`
    );
    expect(body).not.toContain(EN.emailSettingsLeftOutText.message);
  });

  it("writes line breaks as CRLF, as RFC 6068 asks", () => {
    const { href } = buildBugReportEmail(partsFor(EN));
    expect(href).toContain("%0D%0A");
    expect(href.replace(/%0D%0A/g, "")).not.toContain("%0A");
  });

  it("is the support address the page shows", () => {
    expect(SUPPORT_EMAIL).toBe("support@moakh.dev");
  });

  it("leaves the settings out, and says so, when the URL would be too long", () => {
    const settings = Array.from(
      { length: 200 },
      (_, i) => `- setting${i}: true`
    ).join("\n");
    const email = buildBugReportEmail(partsFor(EN, { settings }));
    expect(email.href.length).toBeLessThanOrEqual(MAILTO_MAX_LENGTH);
    expect(email.includesSettings).toBe(false);
    const { body } = decode(email.href);
    expect(body.startsWith(EN.emailBodyPromptText.message)).toBe(true);
    expect(body).toContain(SYSTEM_DETAILS.split("\n").join("\r\n"));
    expect(body).not.toContain("setting0");
    expect(body.endsWith(EN.emailSettingsLeftOutText.message)).toBe(true);
  });

  it("drops the prompt too when even that doesn't fit", () => {
    const email = buildBugReportEmail(
      partsFor(EN, { prompt: "x".repeat(1500) })
    );
    expect(email.href.length).toBeLessThanOrEqual(MAILTO_MAX_LENGTH);
    expect(email.includesSettings).toBe(false);
    const { body } = decode(email.href);
    expect(body).not.toContain("xxx");
    expect(body.startsWith("System details:")).toBe(true);
    expect(body).toContain(EN.emailSettingsLeftOutText.message);
  });

  it("never cuts the system details, even past the limit", () => {
    const systemDetails = `${SYSTEM_DETAILS}\n- ${"y".repeat(2500)}`;
    const email = buildBugReportEmail(partsFor(EN, { systemDetails }));
    expect(email.includesSettings).toBe(false);
    const { body } = decode(email.href);
    expect(body).toContain(systemDetails.split("\n").join("\r\n"));
  });
});

// Non-Latin scripts take up to nine encoded characters per letter, so the
// limit bites differently per language. Whatever the language, the link
// must stay within it and carry the whole system block.
describe.each(
  readdirSync(LOCALES_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
)("the %s bug report email", (locale) => {
  it("fits the mailto limit and keeps the system details whole", () => {
    const messages = readLocale(locale);
    const email = buildBugReportEmail(partsFor(messages));
    expect(email.href.length).toBeLessThanOrEqual(MAILTO_MAX_LENGTH);
    const { body } = decode(email.href);
    expect(body).toContain(SYSTEM_DETAILS.split("\n").join("\r\n"));
    expect(body.startsWith(messages.emailBodyPromptText.message)).toBe(true);
    expect(body.includes(messages.emailSettingsLeftOutText.message)).toBe(
      !email.includesSettings
    );
  });

  // The Help page's "Still stuck?" text points people to the button, so it
  // has to use the label the Support page shows.
  it("names the email button in the Help page's troubleshooting text", () => {
    const messages = readLocale(locale);
    expect(messages.helpTroubleshootingBody.message).toContain(
      messages.emailBugReportText.message
    );
  });
});

it("includes the default settings in the English email", () => {
  expect(buildBugReportEmail(partsFor(EN)).includesSettings).toBe(true);
});
