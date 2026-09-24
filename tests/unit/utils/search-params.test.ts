/**
 * @file tests/unit/utils/search-params.test.ts
 * @desc Search state in the URL: defaults, every pools and maps param, and what's unreadable
 *       (bad page numbers, crossed or reversed ranges, unknown tabs, sorts, codes and badged
 *       values) read as unset, never an error; a page capped at 200, a query at 100 characters
 *       and a map reference at 200; ranges snapped to their sliders; and the URL round trip.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { describe, expect, it } from "vitest";
import { YEAR_RANGE } from "@/constants/search";
import {
  EMPTY_MAP_FILTERS,
  EMPTY_POOL_FILTERS,
  parseLengthText,
  parseSearchState,
  type SearchState,
  searchHref,
  serializeSearchState,
} from "@/utils/search-params";

describe("parseSearchState", () => {
  it("reads nothing as the pools tab, page 1, no filters", () => {
    expect(parseSearchState("")).toEqual({ tab: "pools", page: 1, filters: EMPTY_POOL_FILTERS });
  });

  it("reads every pools param", () => {
    expect(
      parseSearchState(
        "?q=owc&year=2019-2023&badged=yes&sr=5.5-6.5&maps=10-&map=129891&sort=maps&page=3",
      ),
    ).toEqual({
      tab: "pools",
      page: 3,
      filters: {
        q: "owc",
        year: [2019, 2023],
        badged: "yes",
        sr: [5.5, 6.5],
        maps: [10, null],
        map: "129891",
        sort: "maps",
      },
    });
  });

  it("reads every maps param", () => {
    expect(
      parseSearchState(
        "tab=maps&q=dive&sr=6%2B&len=1:30-3:00&bpm=180-&ar=9-10&od=-8&cs=4-4.5&played=dt,NM,xx&used=3-&last=2020-&sort=stars",
      ),
    ).toEqual({
      tab: "maps",
      page: 1,
      filters: {
        q: "dive",
        sr: [6, null],
        len: [90, 180],
        bpm: [180, null],
        ar: [9, 10],
        od: [0, 8],
        cs: [4, 4.5],
        played: ["NM", "DT"],
        used: [3, null],
        last: [2020, null],
        sort: "stars",
      },
    });
  });

  it.each([
    ["page=0", 1],
    ["page=abc", 1],
    ["page=01", 1],
    ["page=999", 200],
  ])("reads %s as page %s", (search, page) => {
    expect(parseSearchState(search).page).toBe(page);
  });

  it("ignores what it can't read", () => {
    expect(parseSearchState("tab=teams&sr=6-4&year=x&badged=maybe&sort=random&maps=-")).toEqual({
      tab: "pools",
      page: 1,
      filters: EMPTY_POOL_FILTERS,
    });
    expect(parseSearchState("tab=maps&sort=year&played=SD&len=abc")).toEqual({
      tab: "maps",
      page: 1,
      filters: EMPTY_MAP_FILTERS,
    });
  });

  it("caps the query and the map reference, and drops ranges that cover the whole slider", () => {
    const state = parseSearchState(
      `q=${"a".repeat(300)}&map=${"1".repeat(300)}&year=2007-${YEAR_RANGE.max}`,
    );
    expect(state.tab === "pools" && state.filters.q).toHaveLength(100);
    expect(state.tab === "pools" && state.filters.map).toHaveLength(200);
    expect(state.tab === "pools" && state.filters.year).toBeNull();
  });
});

describe("serializeSearchState", () => {
  it("writes only what's set, in a fixed order, the query last", () => {
    const state: SearchState = {
      tab: "maps",
      page: 2,
      filters: {
        ...EMPTY_MAP_FILTERS,
        q: "freedom dive",
        sr: [6, null],
        played: ["NM", "HD"],
        sort: "last",
      },
    };
    expect(serializeSearchState(state)).toBe(
      "tab=maps&sr=6-&played=NM,HD&sort=last&page=2&q=freedom%20dive",
    );
    expect(searchHref(state)).toBe(
      "/search?tab=maps&sr=6-&played=NM,HD&sort=last&page=2&q=freedom%20dive",
    );
    expect(searchHref({ tab: "pools", page: 1, filters: EMPTY_POOL_FILTERS })).toBe("/search");
  });

  it.each<SearchState>([
    {
      tab: "pools",
      page: 7,
      filters: {
        q: "Café (20k-10k)",
        year: [2015, 2020],
        badged: "unknown",
        sr: [0, 5.25],
        maps: [8, 16],
        map: "https://osu.ppy.sh/b/75",
        sort: "name",
      },
    },
    {
      tab: "maps",
      page: 1,
      filters: {
        ...EMPTY_MAP_FILTERS,
        len: [95, null],
        bpm: [150, 200],
        ar: [9.3, null],
        used: [2, 5],
        last: [2019, 2021],
        sort: "title",
      },
    },
  ])("round-trips %#", (state) => {
    expect(parseSearchState(serializeSearchState(state))).toEqual(state);
  });

  it("writes a lone surrogate in the query as U+FFFD instead of throwing", () => {
    const state: SearchState = {
      tab: "pools",
      page: 1,
      filters: { ...EMPTY_POOL_FILTERS, q: "a\uD800b" },
    };
    expect(serializeSearchState(state)).toBe(`q=${encodeURIComponent("a�b")}`);
  });
});

describe("parseLengthText", () => {
  it.each([
    ["1:35", 95],
    ["3", 180],
    ["2,5", 150],
    ["abc", null],
  ])("reads %j as %s", (text, seconds) => {
    expect(parseLengthText(text)).toBe(seconds);
  });
});
