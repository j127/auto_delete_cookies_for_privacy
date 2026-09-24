/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */
import { readFileSync } from "fs";

// Many people who report bugs aren't technical. Until #431 the bug report
// form was the one inherited from upstream: a block of warnings, a required
// checkbox, nine questions and a trip into the developer tools, under a
// label this repo doesn't have. These tests pin the short form that
// replaced it, so making it longer, or dropping the system information it
// exists to collect, takes a deliberate edit here too.

const read = (path: string): string =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const FORM = read(".github/ISSUE_TEMPLATE/bug-report.yaml");

const EN = JSON.parse(read("extension/_locales/en/messages.json")) as Record<
  string,
  { message: string }
>;

// The items of the top-level `body:` list, one per "  - type: " line.
const ITEMS = FORM.split(/^ {2}- type: /m)
  .slice(1)
  .map((item) => ({
    type: item.slice(0, item.indexOf("\n")).trim(),
    id: /^ {4}id: (\S+)$/m.exec(item)?.[1],
    label: /^ {6}label: (.+)$/m.exec(item)?.[1],
    required: /^ {6}required: true$/m.test(item),
  }));

// Everything but the markdown blocks is a question the reporter answers.
const QUESTIONS = ITEMS.filter((item) => item.type !== "markdown");

describe("bug report form", () => {
  it("has questions to inspect", () => {
    expect(QUESTIONS.length).toBeGreaterThan(0);
  });

  it("asks six questions at most", () => {
    expect(QUESTIONS.length).toBeLessThanOrEqual(6);
  });

  // The system information is what the form is for. Each of these is easy
  // to answer: two dropdowns and a paste from the Support page.
  it.each(["browser", "os", "system-details"])(
    "makes the %s question required",
    (id) => {
      expect(QUESTIONS.find((question) => question.id === id)?.required).toBe(
        true
      );
    }
  );

  // The tests above find questions by id, and GitHub rejects a form where
  // two questions share an id or a label.
  it("gives every question its own id and label", () => {
    const ids = QUESTIONS.map((question) => question.id);
    const labels = QUESTIONS.map((question) => question.label);
    expect(ids).not.toContain(undefined);
    expect(labels).not.toContain(undefined);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(labels).size).toBe(labels.length);
  });

  // The directions lead people to the Support page's copy buttons by the
  // names on screen, so renaming one of them has to update the form too.
  it.each(["moreControlsText", "supportText", "copyToClipboardText"])(
    "quotes the %s label as the extension shows it",
    (key) => {
      expect(FORM).toContain(`**${EN[key].message}**`);
    }
  );

  // GitHub skips a label the repo doesn't have, without saying so: the
  // upstream form's "untested bug/issue" was never applied to a report.
  it("labels reports as bugs", () => {
    expect(FORM).toMatch(/^labels: \["bug"\]$/m);
  });
});
