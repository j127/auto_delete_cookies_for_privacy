/**
 * @jest-environment jsdom
 */

// Regression pin for the `execArgv` entry in vitest.config.ts. Node >= 25
// ships an experimental `localStorage` global that is undefined unless
// --localstorage-file is given, and vitest's jsdom environment keeps that
// Node global instead of installing jsdom's Storage. Without the flag the
// storage assertions below fail on Node >= 25 (exactly how the
// site-data-service spec first surfaced it) and pass on older Nodes only
// because the feature is off there.

describe("vitest jsdom environment web storage", () => {
  it("runs the workers with Node's experimental Web Storage switched off", () => {
    expect(process.execArgv).toContain("--no-experimental-webstorage");
  });

  it("exposes jsdom's Storage as window.localStorage and window.sessionStorage", () => {
    expect(window.localStorage).toBeInstanceOf(Storage);
    expect(window.sessionStorage).toBeInstanceOf(Storage);

    window.localStorage.clear();
    window.localStorage.setItem("k", "v");
    expect(window.localStorage.getItem("k")).toBe("v");
    expect(window.localStorage.length).toBe(1);
    window.localStorage.clear();
    expect(window.localStorage.length).toBe(0);
  });
});
