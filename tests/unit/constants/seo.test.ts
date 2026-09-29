/**
 * @file tests/unit/constants/seo.test.ts
 * @desc Search copy: the site description and every static page's fit 140 to 160 characters, the
 *       titles are distinct, the link preview's listed size is the real opengraph-image.png's,
 *       /search's common starts are links the search reads as written, the home FAQ is plain
 *       text with no em dash and names no single source.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { HOME_FAQ, HOME_INTRO } from "@/constants/home";
import { PAGE_SEO, SEARCH_INTRO, SEARCH_STARTS, SEO_SITE } from "@/constants/seo";
import { parseSearchState, searchHref } from "@/utils/search-params";

describe("SEO_SITE", () => {
  it("has a 140 to 160 character description and the keyword title", () => {
    expect(SEO_SITE.description.length).toBeGreaterThanOrEqual(140);
    expect(SEO_SITE.description.length).toBeLessThanOrEqual(160);
    expect(SEO_SITE.title).toBe("osu! tournament mappool builder");
  });

  it("lists the link preview at the size the PNG really is", () => {
    const png = readFileSync("src/app/opengraph-image.png");
    const [image] = SEO_SITE.ogImages;
    expect(image?.width).toBe(png.readUInt32BE(16));
    expect(image?.height).toBe(png.readUInt32BE(20));
    expect(image?.alt).toBe(readFileSync("src/app/opengraph-image.alt.txt", "utf8").trim());
  });
});

describe("PAGE_SEO", () => {
  it.each(Object.entries(PAGE_SEO))("%s has a 140 to 160 character description", (_, page) => {
    expect(page.description.length).toBeGreaterThanOrEqual(140);
    expect(page.description.length).toBeLessThanOrEqual(160);
  });

  it("gives every page its own title", () => {
    const titles = Object.values(PAGE_SEO).map((page) => page.title);
    expect(new Set(titles).size).toBe(titles.length);
    expect(titles).not.toContain(SEO_SITE.title);
  });
});

describe("/search common starts", () => {
  it.each(SEARCH_STARTS)("$label links a search as the page writes it", ({ href }) => {
    expect(searchHref(parseSearchState(href.replace(/^\/search\??/, "")))).toBe(href);
  });
});

describe("home copy", () => {
  it("is plain, with no em dash, and names no single source", () => {
    const text = [HOME_INTRO, SEARCH_INTRO, ...HOME_FAQ.flatMap(({ q, a }) => [q, a])].join("\n");
    expect(text).not.toContain("—");
    expect(text).not.toMatch(/otdb|sheppsu|[<>]/i);
    expect(HOME_FAQ.length).toBe(5);
  });
});
