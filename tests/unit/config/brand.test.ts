/**
 * @file tests/unit/config/brand.test.ts
 * @desc The pools brand: the generated palette is hue 200, globals.css pins the same hue (and the
 *       h2 lightness the ui README gives for it), the generated icon files are there,
 *       and so is every file the /brand page links.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Sun Oct 4, 2026
 */

import { existsSync, readFileSync } from "node:fs";
import { brandPageData } from "@haruhimemoe/brand/products";
import { describe, expect, it } from "vitest";
import palette from "../../../public/brand/pools-palette.json" with { type: "json" };

describe("pools brand", () => {
  it("uses hue 200 in the palette and the theme", () => {
    expect(palette.hue).toBe(200);
    const css = readFileSync("src/app/globals.css", "utf8");
    expect(css).toMatch(/--hue:\s*200;/);
    expect(css).toMatch(/--h2-l:\s*42%;/);
  });

  it.each([
    "public/brand/pools-wordmark.svg",
    "public/brand/pools-wordmark-on-light.svg",
    "public/brand/pools-icon.svg",
    "public/brand/pools-banner.svg",
    "src/app/icon.svg",
    "src/app/apple-icon.png",
    "src/app/opengraph-image.png",
    "src/app/opengraph-image.alt.txt",
  ])("ships %s", (file) => {
    expect(existsSync(file)).toBe(true);
  });

  it.each(brandPageData("pools").assets.map((a) => a.href))("ships /brand's %s", (href) => {
    expect(existsSync(`public${href}`)).toBe(true);
  });
});
