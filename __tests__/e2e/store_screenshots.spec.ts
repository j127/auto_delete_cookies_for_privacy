/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */

/**
 * The pure helpers of the Firefox store-screenshot run (#486), and the
 * listing copy that has to name the same files with the same captions:
 * AMO's caption fields are filled from docs/store/firefox/listing.md.
 */
import { readFileSync } from "fs";
import {
  allShotFiles,
  BACKDROPS,
  CARD_MARGIN,
  cardTop,
  FIREFOX_STORE_SHOTS,
  nextWindowSize,
  pngSize,
  SHOT_THEMES,
  shotFileName,
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

  it("says the listing icon is a separate upload", () => {
    expect(assets).toContain("extension/icons/icon_128.png");
    expect(assets).not.toMatch(/no separate upload needed/);
  });
});
