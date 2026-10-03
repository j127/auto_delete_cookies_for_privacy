/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */
import { readdirSync, readFileSync } from "fs";

// #434 followed #431, which rewrote the bug report form. The two other
// forms were still upstream's: warnings that issues WILL be closed, a
// required acknowledgement checkbox, a "???" in the title for people to
// delete, upstream's maintainer as assignee, and labels this repo doesn't
// have. The support form went away, since config.yml already sends support
// questions to Discussions. The feature form was rewritten in the bug
// form's plain style. These tests pin both outcomes.

const read = (path: string): string =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const TEMPLATE_DIR = ".github/ISSUE_TEMPLATE";

const FORM = read(`${TEMPLATE_DIR}/feature-request.yaml`);
const CONFIG = read(`${TEMPLATE_DIR}/config.yml`);

// Every issue form in the folder, as [file name, contents].
const FORMS = readdirSync(new URL(`../${TEMPLATE_DIR}`, import.meta.url))
  .filter((file) => /\.ya?ml$/.test(file) && file !== "config.yml")
  .map((file) => [file, read(`${TEMPLATE_DIR}/${file}`)] as const);

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

describe("feature request form", () => {
  it("has questions to inspect", () => {
    expect(QUESTIONS.length).toBeGreaterThan(0);
  });

  it("asks three questions at most", () => {
    expect(QUESTIONS.length).toBeLessThanOrEqual(3);
  });

  // Only the idea itself is required. The rest is optional, so someone
  // with a one-line idea can still send it.
  it("requires only the idea", () => {
    expect(
      QUESTIONS.filter((question) => question.required).map(
        (question) => question.id
      )
    ).toEqual(["idea"]);
  });

  // GitHub rejects a form where two questions share an id or a label.
  it("gives every question its own id and label", () => {
    const ids = QUESTIONS.map((question) => question.id);
    const labels = QUESTIONS.map((question) => question.label);
    expect(ids).not.toContain(undefined);
    expect(labels).not.toContain(undefined);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(labels).size).toBe(labels.length);
  });

  // GitHub skips a label the repo doesn't have, without saying so: the
  // upstream form's "Feature Request" was never applied to a request.
  it("labels requests as enhancements", () => {
    expect(FORM).toMatch(/^labels: \["enhancement"\]$/m);
  });
});

describe("issue forms", () => {
  it("has forms to inspect", () => {
    expect(FORMS.length).toBeGreaterThan(0);
  });

  // Support questions go to Discussions through config.yml instead.
  it("has no support request form", () => {
    expect(FORMS.map(([file]) => file)).toEqual(
      expect.not.arrayContaining([
        expect.stringMatching(/^support-request\.ya?ml$/),
      ])
    );
  });

  it.each(FORMS)("leaves no ??? in the title of %s", (_file, form) => {
    expect(form).not.toMatch(/^title: .*\?\?\?/m);
  });

  it.each(FORMS)("has no checkboxes in %s", (_file, form) => {
    expect(form).not.toMatch(/^ {2}- type: checkboxes$/m);
  });

  it.each(FORMS)(
    "warns nobody that issues WILL be closed in %s",
    (_file, form) => {
      expect(form).not.toMatch(/WILL be closed/i);
    }
  );

  // Upstream's forms assigned upstream's maintainer, who isn't part of
  // this repo.
  it.each(FORMS)("assigns nobody in %s", (_file, form) => {
    expect(form).not.toMatch(/^assignees:/m);
  });
});

describe("issue chooser links", () => {
  // With the support form gone, this link is where support questions go.
  it("sends support questions to Discussions", () => {
    expect(CONFIG).toContain(
      "url: https://github.com/j127/auto_delete_cookies_for_privacy/discussions/new"
    );
    expect(CONFIG).toMatch(/support questions/i);
  });
});
