/**
 * @jest-environment jsdom
 */

// Environment smoke test: in a jsdom spec, window.localStorage and
// window.sessionStorage must be jsdom's Storage. Node >= 25 defines its own
// `localStorage` global (undefined unless --localstorage-file is given), and
// under vitest 4 that global shadowed jsdom's, which broke the
// site-data-service spec on Node 26 (#388). Vitest 5 installs jsdom's
// Storage over the Node global (vitest-dev/vitest#10293), so the `execArgv`
// workaround from #388 is gone (#394), and this test is what notices if the
// shadowing ever comes back.

describe("vitest jsdom environment web storage", () => {
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
