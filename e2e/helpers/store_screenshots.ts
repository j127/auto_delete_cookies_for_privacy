/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */

/**
 * The pure parts of the Firefox store-screenshot run (#486): which shots
 * exist, what they are called and captioned, how the popup is framed, and
 * the size checks every PNG must pass. The browser side lives in
 * e2e/store/firefox_store_screenshots.shots.ts; this file stays free of
 * webdriver so the unit spec (__tests__/e2e/store_screenshots.spec.ts) can
 * check it, and so docs/store/firefox/listing.md can be held to the same
 * list of files and captions.
 */

/** Every store shot is this size, as the Chrome Web Store set is. */
export const STORE_SHOT_SIZE = { width: 1280, height: 800 } as const;

export type ShotTheme = "light" | "dark";

/** Each shot is taken once per theme, light first. */
export const SHOT_THEMES: readonly ShotTheme[] = ["light", "dark"];

export interface StoreShot {
  /** Position in the listing; also the file name's prefix. */
  number: number;
  slug: string;
  /** One short sentence for AMO's caption field. */
  caption: string;
}

/** The Firefox listing's shots, in upload order. */
export const FIREFOX_STORE_SHOTS: readonly StoreShot[] = [
  {
    number: 1,
    slug: "popup",
    caption:
      "The popup shows the site's container and what the site stores, and keeps its cookies in one click.",
  },
  {
    number: 2,
    slug: "protection",
    caption:
      "Give each Firefox container its own keep list from the Protection page.",
  },
  {
    number: 3,
    slug: "saved-sites",
    caption:
      "Saved sites holds a separate keep list for each container, next to the Default and Private lists.",
  },
  {
    number: 4,
    slug: "overview",
    caption:
      "The Overview counts the cookies deleted so far and lists what is new in each release.",
  },
];

/** "01-popup.png", or "01-popup-dark.png" for the dark theme. */
export const shotFileName = (shot: StoreShot, theme: ShotTheme): string =>
  `${String(shot.number).padStart(2, "0")}-${shot.slug}${
    theme === "dark" ? "-dark" : ""
  }.png`;

/** Every file the run writes, in listing order (each shot light, then dark). */
export const allShotFiles = (): { file: string; shot: StoreShot }[] =>
  FIREFOX_STORE_SHOTS.flatMap((shot) =>
    SHOT_THEMES.map((theme) => ({ file: shotFileName(shot, theme), shot }))
  );

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/**
 * The pixel size a PNG declares in its IHDR chunk, which the format puts
 * first, right after the eight-byte signature.
 */
export const pngSize = (png: Uint8Array): { width: number; height: number } => {
  const isPng =
    png.length >= 24 &&
    PNG_SIGNATURE.every((byte, i) => png[i] === byte) &&
    String.fromCharCode(...png.slice(12, 16)) === "IHDR";
  if (!isPng) throw new Error("not a PNG: no signature and IHDR chunk");
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
};

/**
 * The window size that should make the screenshot exactly the target size.
 * The browser's own toolbars take part of the window, so the window is
 * grown by whatever the last screenshot fell short (or shrunk by what it
 * overshot).
 */
export const nextWindowSize = (
  window: { width: number; height: number },
  shot: { width: number; height: number },
  target: { width: number; height: number } = STORE_SHOT_SIZE
): { width: number; height: number } => ({
  width: window.width + target.width - shot.width,
  height: window.height + target.height - shot.height,
});

/** The least space kept above and below the popup card. */
export const CARD_MARGIN = 24;

/** The popup's own width; the card is exactly that wide. */
export const POPUP_WIDTH = 430;

/**
 * Where the popup card's top edge goes so the card sits centred on the
 * backdrop. A card too tall to keep CARD_MARGIN at both ends would be cut
 * off, so that is an error: trim the fixture data instead.
 */
export const cardTop = (
  cardHeight: number,
  viewportHeight: number = STORE_SHOT_SIZE.height
): number => {
  if (cardHeight + 2 * CARD_MARGIN > viewportHeight) {
    throw new Error(
      `popup card is ${cardHeight}px tall; at most ${viewportHeight - 2 * CARD_MARGIN}px fits`
    );
  }
  return Math.round((viewportHeight - cardHeight) / 2);
};

/**
 * The soft backdrop behind the popup card, matching the Chrome Web Store
 * set (docs/store/screenshots/01-popup.png and 04-popup-dark.png).
 */
export const BACKDROPS: Record<
  ShotTheme,
  { background: string; shadow: string }
> = {
  light: {
    background:
      "linear-gradient(135deg, #dbe5fb 0%, #edf0f6 50%, #dde6f4 100%)",
    shadow: "0 24px 60px rgba(30, 41, 59, 0.22)",
  },
  dark: {
    background:
      "linear-gradient(135deg, #111827 0%, #141a2a 50%, #0d1834 100%)",
    shadow: "0 24px 60px rgba(0, 0, 0, 0.55)",
  },
};

/**
 * How far above a cut-off block the bottom fade starts. Small, so the
 * whole block above it stays clear.
 */
export const FADE_LEAD = 8;

/**
 * How tall the fade is from clear to the page's background colour: the
 * same as FADE_LEAD, so the cut-off block is fully covered from its top.
 */
export const FADE_RAMP = FADE_LEAD;

/**
 * Where a settings page's bottom fade starts, or null when no fade is
 * needed. A long page runs on below the viewport, and the block (a
 * settings row, a list item, a heading) that the bottom edge cuts through
 * would show as half a line of text. The fade starts just above the
 * highest such block, so that block is hidden whole and the visible page
 * ends on whole blocks. When the edge falls between blocks, nothing is cut
 * and no fade is added.
 */
export const bottomFadeTop = (
  blocks: readonly { top: number; bottom: number }[],
  viewportHeight: number = STORE_SHOT_SIZE.height
): number | null => {
  const cut = blocks.filter(
    (b) => b.top < viewportHeight && b.bottom > viewportHeight
  );
  if (cut.length === 0) return null;
  const top = Math.min(...cut.map((b) => b.top)) - FADE_LEAD;
  // Never fade more than the bottom third away.
  return Math.max(Math.round(top), Math.round((viewportHeight * 2) / 3));
};
