/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */

/**
 * The pure helpers of the Firefox store-screenshot run (#486), and the
 * listing copy that has to name the same files with the same captions:
 * AMO's caption fields are filled from docs/store/firefox/listing.md.
 */
import { readdirSync, readFileSync } from "fs";
import {
  allShotFiles,
  BACKDROPS,
  bottomCoverTop,
  CARD_MARGIN,
  cardTop,
  FIREFOX_STORE_SHOTS,
  nextWindowSize,
  pngSize,
  SHOT_THEMES,
  shotFileName,
  sizeViewportTo,
  STORE_SHOT_SIZE,
} from "../../e2e/helpers/store_screenshots";

/** A minimal PNG header: signature, then an IHDR chunk with the size. */
const pngHeader = (width: number, height: number): Uint8Array => {
  const bytes = new Uint8Array(33);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  const view = new DataView(bytes.buffer);
  view.setUint32(8, 13);
  bytes.set(
    [..."IHDR"].map((c) => c.charCodeAt(0)),
    12
  );
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes;
};

describe("store shots", () => {
  it("numbers the shots 1, 2, 3, ... with unique names", () => {
    expect(FIREFOX_STORE_SHOTS.map((s) => s.number)).toEqual(
      FIREFOX_STORE_SHOTS.map((_, i) => i + 1)
    );
    const slugs = FIREFOX_STORE_SHOTS.map((s) => s.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(slug).toMatch(/^[a-z]+(-[a-z]+)*$/);
  });

  it("captions every shot with one short sentence", () => {
    for (const { caption } of FIREFOX_STORE_SHOTS) {
      expect(caption).toMatch(/^[A-Z][^.]*\.$/);
      expect(caption.length).toBeLessThanOrEqual(120);
    }
  });

  it("names the light file plainly and the dark one with -dark", () => {
    const [popup] = FIREFOX_STORE_SHOTS;
    expect(shotFileName(popup, "light")).toBe("01-popup.png");
    expect(shotFileName(popup, "dark")).toBe("01-popup-dark.png");
    expect(
      shotFileName({ number: 12, slug: "x-y", caption: "X." }, "dark")
    ).toBe("12-x-y-dark.png");
  });

  it("lists each shot light then dark, in shot order", () => {
    expect(SHOT_THEMES).toEqual(["light", "dark"]);
    expect(allShotFiles().map((f) => f.file)).toEqual([
      "01-popup.png",
      "01-popup-dark.png",
      "02-protection.png",
      "02-protection-dark.png",
      "03-saved-sites.png",
      "03-saved-sites-dark.png",
      "04-overview.png",
      "04-overview-dark.png",
    ]);
  });
});

describe("pngSize", () => {
  it("reads the width and height from the IHDR chunk", () => {
    expect(pngSize(pngHeader(1280, 800))).toEqual({ width: 1280, height: 800 });
    expect(pngSize(pngHeader(70000, 3))).toEqual({ width: 70000, height: 3 });
  });

  it("reads a PNG that sits inside a larger buffer", () => {
    const outer = new Uint8Array(40);
    outer.set(pngHeader(640, 480), 4);
    expect(pngSize(outer.subarray(4))).toEqual({ width: 640, height: 480 });
  });

  it("refuses bytes that are not a PNG", () => {
    expect(() => pngSize(new Uint8Array(10))).toThrow(/not a PNG/);
    const jpeg = pngHeader(1, 1);
    jpeg[0] = 0xff;
    expect(() => pngSize(jpeg)).toThrow(/not a PNG/);
    const noHeader = pngHeader(1, 1);
    noHeader[12] = "X".charCodeAt(0);
    expect(() => pngSize(noHeader)).toThrow(/not a PNG/);
  });
});

describe("nextWindowSize", () => {
  it("grows the window by what the toolbars took", () => {
    expect(
      nextWindowSize({ width: 1280, height: 900 }, { width: 1280, height: 815 })
    ).toEqual({ width: 1280, height: 885 });
  });

  it("shrinks it by what the screenshot overshot", () => {
    expect(
      nextWindowSize(
        { width: 1300, height: 900 },
        { width: 1290, height: 810 },
        { width: 1280, height: 800 }
      )
    ).toEqual({ width: 1290, height: 890 });
  });

  it("leaves a window alone that already gives the store size", () => {
    expect(
      nextWindowSize({ width: 1280, height: 885 }, STORE_SHOT_SIZE)
    ).toEqual({ width: 1280, height: 885 });
  });
});

/**
 * A window whose toolbars take `chrome` of it, with the measured tab in
 * front or in the background. A tab in the background keeps the viewport it
 * had when it went there, as Firefox's does. After a resize the viewport of
 * a tab in front keeps reporting its old size for `lagPolls` screenshots;
 * the first `ignoredResizes` resizes do nothing at all; and another tab
 * takes the front just before each resize numbered in `stolenBeforeResize`.
 */
const fakeWindow = ({
  window,
  chrome = { width: 0, height: 86 },
  inFront = true,
  lagPolls = 0,
  ignoredResizes = 0,
  stolenBeforeResize = [],
}: {
  window: { width: number; height: number };
  chrome?: { width: number; height: number };
  inFront?: boolean;
  lagPolls?: number;
  ignoredResizes?: number;
  stolenBeforeResize?: number[];
}) => {
  const viewportOf = (size: { width: number; height: number }) => ({
    width: size.width - chrome.width,
    height: size.height - chrome.height,
  });
  let current = window;
  let shown = viewportOf(window);
  let stalePolls = 0;
  let front = inFront;
  const resizes: { width: number; height: number }[] = [];
  const sleeps: number[] = [];
  const calls: string[] = [];
  return {
    resizes,
    sleeps,
    /** "show", "resize" and "shot", in the order they were made. */
    calls,
    sleep: async (ms: number) => {
      sleeps.push(ms);
    },
    showTab: async () => {
      calls.push("show");
      front = true;
    },
    windowSize: async () => current,
    resizeWindow: async (size: { width: number; height: number }) => {
      calls.push("resize");
      resizes.push(size);
      if (stolenBeforeResize.includes(resizes.length)) front = false;
      if (resizes.length <= ignoredResizes) return;
      current = size;
      stalePolls = lagPolls;
    },
    viewportSize: async () => {
      calls.push("shot");
      if (!front) return shown;
      if (stalePolls > 0) stalePolls--;
      else shown = viewportOf(current);
      return shown;
    },
  };
};

describe("sizeViewportTo", () => {
  // Headless Firefox's first window, as in the CI run that failed.
  const HEADLESS_WINDOW = { width: 1366, height: 768 };
  const HEADLESS_VIEWPORT = { width: 1366, height: 682 };
  const SIZED_WINDOW = { width: 1280, height: 886 };

  it("leaves a window alone whose viewport already fits", async () => {
    const win = fakeWindow({ window: SIZED_WINDOW });
    expect(await sizeViewportTo(win, STORE_SHOT_SIZE, win)).toEqual([]);
    expect(win.resizes).toEqual([]);
    expect(win.sleeps).toEqual([]);
  });

  it("makes room for the toolbars in one resize", async () => {
    const win = fakeWindow({ window: HEADLESS_WINDOW });
    expect(await sizeViewportTo(win, STORE_SHOT_SIZE, win)).toEqual([
      { window: SIZED_WINDOW, viewport: STORE_SHOT_SIZE, waitedMs: 0 },
    ]);
    expect(win.resizes).toEqual([SIZED_WINDOW]);
    expect(win.sleeps).toEqual([]);
  });

  it("brings a tab in the background to the front before it measures or resizes", async () => {
    // The options page the extension opens on install took the front.
    const win = fakeWindow({ window: HEADLESS_WINDOW, inFront: false });
    expect(await sizeViewportTo(win, STORE_SHOT_SIZE, win)).toEqual([
      { window: SIZED_WINDOW, viewport: STORE_SHOT_SIZE, waitedMs: 0 },
    ]);
    expect(win.calls).toEqual(["show", "shot", "resize", "show", "shot"]);
    expect(win.sleeps).toEqual([]);
  });

  it("is what a tab left in the background would fail on", async () => {
    const win = fakeWindow({ window: HEADLESS_WINDOW, inFront: false });
    await expect(
      sizeViewportTo({ ...win, showTab: async () => {} }, STORE_SHOT_SIZE, {
        sleep: win.sleep,
        attempts: 2,
        settleMs: 200,
      })
    ).rejects.toThrow(/could not size the viewport to 1280x800/);
    // The window followed each resize; the viewport never did.
    expect(win.resizes).toEqual([SIZED_WINDOW, { width: 1194, height: 1004 }]);
    expect(await win.viewportSize()).toEqual(HEADLESS_VIEWPORT);
  });

  it("brings the tab back when another takes the front before the resize", async () => {
    const win = fakeWindow({
      window: HEADLESS_WINDOW,
      stolenBeforeResize: [1],
    });
    expect(await sizeViewportTo(win, STORE_SHOT_SIZE, win)).toEqual([
      { window: SIZED_WINDOW, viewport: STORE_SHOT_SIZE, waitedMs: 0 },
    ]);
    // No second resize: one worked out from the stale viewport would be wrong.
    expect(win.resizes).toEqual([SIZED_WINDOW]);
  });

  it("waits for a viewport that follows the window late, without resizing again", async () => {
    const win = fakeWindow({ window: HEADLESS_WINDOW, lagPolls: 7 });
    expect(await sizeViewportTo(win, STORE_SHOT_SIZE, win)).toEqual([
      { window: SIZED_WINDOW, viewport: STORE_SHOT_SIZE, waitedMs: 700 },
    ]);
    // A second resize here would be worked out from a stale screenshot.
    expect(win.resizes).toEqual([SIZED_WINDOW]);
    expect(win.sleeps).toEqual(Array(7).fill(100));
  });

  it("asks again when a resize did nothing", async () => {
    const win = fakeWindow({ window: HEADLESS_WINDOW, ignoredResizes: 1 });
    const tried = await sizeViewportTo(win, STORE_SHOT_SIZE, {
      sleep: win.sleep,
      settleMs: 300,
    });
    expect(tried).toEqual([
      { window: SIZED_WINDOW, viewport: HEADLESS_VIEWPORT, waitedMs: 300 },
      { window: SIZED_WINDOW, viewport: STORE_SHOT_SIZE, waitedMs: 0 },
    ]);
    expect(win.resizes).toEqual([SIZED_WINDOW, SIZED_WINDOW]);
  });

  it("measures again once the viewport has settled on another size", async () => {
    // The first screenshot is a pixel taller than the viewport really is,
    // so the first resize leaves the window a pixel short.
    const win = fakeWindow({ window: HEADLESS_WINDOW });
    const viewportSize = win.viewportSize;
    win.viewportSize = async () => {
      const size = await viewportSize();
      return win.resizes.length === 0
        ? { width: size.width, height: size.height + 1 }
        : size;
    };
    const tried = await sizeViewportTo(win, STORE_SHOT_SIZE, {
      sleep: win.sleep,
      settleMs: 200,
    });
    expect(tried.map((t) => t.viewport)).toEqual([
      { width: 1280, height: 799 },
      STORE_SHOT_SIZE,
    ]);
    expect(win.resizes).toEqual([{ width: 1280, height: 885 }, SIZED_WINDOW]);
  });

  it("gives up after the last attempt, naming every resize it made", async () => {
    const win = fakeWindow({ window: HEADLESS_WINDOW, ignoredResizes: 99 });
    await expect(
      sizeViewportTo(win, STORE_SHOT_SIZE, {
        sleep: win.sleep,
        attempts: 3,
        settleMs: 200,
        pollMs: 50,
      })
    ).rejects.toThrow(
      `could not size the viewport to 1280x800: ${JSON.stringify(
        Array(3).fill({
          window: SIZED_WINDOW,
          viewport: HEADLESS_VIEWPORT,
          waitedMs: 200,
        })
      )}`
    );
    expect(win.resizes).toHaveLength(3);
    expect(win.sleeps).toEqual(Array(12).fill(50));
  });

  it("waits five seconds a resize, four times, by default", async () => {
    const win = fakeWindow({ window: HEADLESS_WINDOW, ignoredResizes: 99 });
    await expect(
      sizeViewportTo(win, STORE_SHOT_SIZE, { sleep: win.sleep })
    ).rejects.toThrow(/could not size the viewport/);
    expect(win.resizes).toHaveLength(4);
    expect(win.sleeps).toEqual(Array(200).fill(100));
  });
});

describe("cardTop", () => {
  it("centres the card vertically", () => {
    expect(cardTop(600)).toBe(100);
    expect(cardTop(601)).toBe(100);
    expect(cardTop(300, 500)).toBe(100);
  });

  it("accepts a card that just keeps its margins", () => {
    expect(cardTop(800 - 2 * CARD_MARGIN)).toBe(CARD_MARGIN);
  });

  it("refuses a card too tall to fit", () => {
    expect(() => cardTop(800 - 2 * CARD_MARGIN + 1)).toThrow(/at most 752px/);
  });
});

describe("bottomCoverTop", () => {
  it("covers nothing when the bottom edge falls between blocks", () => {
    expect(
      bottomCoverTop([
        { top: 100, bottom: 400 },
        { top: 420, bottom: 790 },
        { top: 806, bottom: 900 },
      ])
    ).toBeNull();
    expect(bottomCoverTop([])).toBeNull();
  });

  it("starts at the top of the block the edge cuts through", () => {
    expect(
      bottomCoverTop([
        { top: 100, bottom: 732 },
        { top: 735.4, bottom: 810 },
      ])
    ).toBe(735);
  });

  it("covers a cut row whole, not just the cut line inside it", () => {
    // A settings row and the paragraph inside it are both cut.
    expect(
      bottomCoverTop([
        { top: 700, bottom: 830 },
        { top: 770, bottom: 830 },
      ])
    ).toBe(700);
  });

  it("never covers more than the bottom third", () => {
    expect(bottomCoverTop([{ top: 100, bottom: 1400 }])).toBe(533);
    expect(bottomCoverTop([{ top: 100, bottom: 1400 }], 600)).toBe(400);
  });

  it("ignores blocks wholly below the viewport", () => {
    expect(bottomCoverTop([{ top: 800, bottom: 900 }])).toBeNull();
  });
});

describe("backdrops", () => {
  it("has a backdrop for every theme", () => {
    for (const theme of SHOT_THEMES) {
      expect(BACKDROPS[theme].background).toMatch(/^linear-gradient\(/);
      expect(BACKDROPS[theme].shadow).not.toBe("");
    }
  });
});

describe("docs/store/firefox/listing.md", () => {
  const listing = readFileSync(
    new URL("../../docs/store/firefox/listing.md", import.meta.url),
    "utf8"
  );
  const assets = listing.slice(listing.indexOf("## Assets"));

  it.each(allShotFiles())("lists $file with its caption", ({ file, shot }) => {
    const row = assets
      .split("\n")
      .find((line) => line.includes(`firefox/${file})`));
    expect(row, `no row for ${file}`).toBeDefined();
    expect(row).toContain(shot.caption);
  });

  it("lists no other shot files than the run writes", () => {
    const listed = [
      ...assets.matchAll(/\(\.\.\/screenshots\/firefox\/([^)]+)\)/g),
    ].map((m) => m[1]);
    expect(listed).toEqual(allShotFiles().map((f) => f.file));
  });

  it("says the listing icon is a separate upload", () => {
    expect(assets).toContain("extension/icons/icon_128.png");
    expect(assets).not.toMatch(/no separate upload needed/);
  });
});

describe("docs/store/screenshots/firefox", () => {
  const dir = new URL("../../docs/store/screenshots/firefox/", import.meta.url);

  it("holds exactly the files the run writes", () => {
    expect(readdirSync(dir).sort()).toEqual(
      allShotFiles()
        .map((f) => f.file)
        .sort()
    );
  });

  it.each(allShotFiles())("$file is a 1280x800 PNG", ({ file }) => {
    expect(pngSize(readFileSync(new URL(file, dir)))).toEqual(STORE_SHOT_SIZE);
  });
});
