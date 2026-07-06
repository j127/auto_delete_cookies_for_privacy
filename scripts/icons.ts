/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */

/**
 * Regenerates every extension icon PNG from the logo source SVG. Run with
 * `just icons_build` (or `bun run scripts/icons.ts`). Requires rsvg-convert
 * (`brew install librsvg`); the PNGs are committed, so CI and normal builds
 * never need it.
 *
 * The state variants recolor accents only, keeping the mark recognizable:
 * - default    red prohibition ring, tan cookie (SVG verbatim)
 * - yellow     greylisted: ring/slash take the badge yellow from
 *              browser-action-service
 * - red        site will be cleaned: cookie body/chips tint red (the ring
 *              is already red)
 * - greyscale  auto-clean disabled: full desaturation
 */

import { join } from "path";

const root = join(import.meta.dir, "..");
const sourceSvg = join(root, "image_editing", "cookie-prohibited.svg");
const iconsDir = join(root, "extension", "icons");

// Source palette (see image_editing/cookie-prohibited.svg).
const COOKIE_BODY = "#D89B53";
const COOKIE_CHIPS = "#5E371B";
const RING = "#E02929";

type ColorMap = { [from: string]: string };

const VARIANTS: { suffix: string; colors: ColorMap }[] = [
  { suffix: "", colors: {} },
  // Matches the "yellow" badgeBackgroundColor in browser-action-service.
  { suffix: "_yellow", colors: { [RING]: "#e6a32e" } },
  {
    suffix: "_red",
    colors: { [COOKIE_BODY]: "#D96450", [COOKIE_CHIPS]: "#7A2A1D" },
  },
  {
    suffix: "_greyscale",
    colors: {
      [COOKIE_BODY]: "#B9B9B9",
      [COOKIE_CHIPS]: "#5E5E5E",
      [RING]: "#8A8A8A",
    },
  },
];

// The default logo ships at every referenced size; the state variants are
// only ever requested at 48 (browser-action-service setIcon paths).
const DEFAULT_SIZES = [24, 32, 48, 128];
const VARIANT_SIZE = 48;

const recolor = (svg: string, colors: ColorMap): string => {
  let out = svg;
  for (const [from, to] of Object.entries(colors)) {
    out = out.split(from).join(to);
  }
  return out;
};

const rasterize = async (
  svg: string,
  size: number,
  outFile: string
): Promise<void> => {
  const proc = Bun.spawn(
    ["rsvg-convert", "-w", `${size}`, "-h", `${size}`, "-o", outFile],
    { stdin: new TextEncoder().encode(svg), stderr: "inherit" }
  );
  if ((await proc.exited) !== 0) {
    throw new Error(`rsvg-convert failed for ${outFile}`);
  }
};

const which = Bun.spawnSync(["which", "rsvg-convert"]);
if (which.exitCode !== 0) {
  console.error(
    "rsvg-convert not found — install it with `brew install librsvg`."
  );
  process.exit(1);
}

const svg = await Bun.file(sourceSvg).text();
const written: string[] = [];

for (const { suffix, colors } of VARIANTS) {
  const variantSvg = recolor(svg, colors);
  const sizes = suffix === "" ? DEFAULT_SIZES : [VARIANT_SIZE];
  for (const size of sizes) {
    const out = join(iconsDir, `icon_${size}${suffix}.png`);
    await rasterize(variantSvg, size, out);
    written.push(out.replace(`${root}/`, ""));
  }
}

console.log(`wrote ${written.length} icons\n  ${written.join("\n  ")}`);
