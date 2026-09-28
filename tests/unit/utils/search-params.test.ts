/**
 * @file tests/unit/utils/search-params.test.ts
 * @desc Search state in the URL: defaults, every pools and maps param, and what's unreadable
 *       (bad page numbers, crossed or reversed ranges, unknown tabs, sorts, codes and badged
 *       values) read as unset, never an error; a page capped at 200, a query at 100 characters
 *       and a map reference at 200; ranges snapped to their sliders; and the URL round trip. The
 *       maps tab's scope: all maps by default, played for old links with a played-only filter,
 *       scope winning when given, all-maps status and Show explicit maps.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Mon Sep 28, 2026
 */

import { describe, expect, it } from "vitest";
import { YEAR_RANGE } from "@/constants/search";
import {
  EMPTY_ALL_MAP_FILTERS,
  EMPTY_MAP_FILTERS,
  EMPTY_POOL_FILTERS,
  hasPoolFilters,
  type SearchState,
} from "@/utils/search-filters";
import { parseSearchState, searchHref, serializeSearchState } from "@/utils/search-params";
import { parseLengthText } from "@/utils/search-ranges";

describe("parseSearchState", () => {
  it("reads nothing as the pools tab, page 1, no filters", () => {
    expect(parseSearchState("")).toEqual({ tab: "pools", page: 1, filters: EMPTY_POOL_FILTERS });
  });

  it("reads every pools param", () => {
    expect(
      parseSearchState(
        "?type=both&q=owc&year=2019-2023&badged=yes&sr=5.5-6.5&maps=10-&map=129891&sort=maps&page=3",
      ),
    ).toEqual({
      tab: "pools",
      page: 3,
      filters: {
        type: "both",
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
      scope: "played",
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
      scope: "played",
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

describe("the pools tab's type", () => {
  it("reads past pools from a link without one, or with one it doesn't know", () => {
    expect(parseSearchState("q=owc").filters).toMatchObject({ type: "past" });
    expect(parseSearchState("type=secret").filters).toMatchObject({ type: "past" });
    expect(parseSearchState("type=built").filters).toMatchObject({ type: "built" });
  });

  it("drops badged and stars for built pools only: they have neither", () => {
    expect(parseSearchState("type=built&sr=5-&badged=yes").filters).toMatchObject({
      sr: null,
      badged: "any",
    });
    expect(parseSearchState("type=both&sr=5-&badged=yes").filters).toMatchObject({
      sr: [5, null],
      badged: "yes",
    });
  });

  it("writes the type first, and none for past pools", () => {
    const built = { ...EMPTY_POOL_FILTERS, type: "built" as const, q: "cup" };
    expect(searchHref({ tab: "pools", page: 1, filters: built })).toBe("/search?type=built&q=cup");
    const past = { ...EMPTY_POOL_FILTERS, q: "cup" };
    expect(searchHref({ tab: "pools", page: 1, filters: past })).toBe("/search?q=cup");
  });

  it("isn't a filter the Clear button clears", () => {
    expect(hasPoolFilters({ ...EMPTY_POOL_FILTERS, type: "both" })).toBe(false);
  });
});

describe("serializeSearchState", () => {
  it("writes only what's set, in a fixed order, the query last", () => {
    const state: SearchState = {
      tab: "maps",
      scope: "played",
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
      "tab=maps&scope=played&sr=6-&played=NM,HD&sort=last&page=2&q=freedom%20dive",
    );
    expect(searchHref(state)).toBe(
      "/search?tab=maps&scope=played&sr=6-&played=NM,HD&sort=last&page=2&q=freedom%20dive",
    );
    expect(searchHref({ tab: "pools", page: 1, filters: EMPTY_POOL_FILTERS })).toBe("/search");
  });

  it.each<SearchState>([
    {
      tab: "pools",
      page: 7,
      filters: {
        type: "both",
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
      scope: "played",
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

describe("the maps tab's scope", () => {
  it("reads a maps search with no scope and no played-only filter as all maps", () => {
    expect(parseSearchState("tab=maps&q=dive&sr=6-7&len=90-&bpm=180-")).toEqual({
      tab: "maps",
      scope: "all",
      page: 1,
      filters: {
        ...EMPTY_ALL_MAP_FILTERS,
        q: "dive",
        sr: [6, 7],
        len: [90, null],
        bpm: [180, null],
      },
    });
    expect(parseSearchState("tab=maps")).toEqual({
      tab: "maps",
      scope: "all",
      page: 1,
      filters: EMPTY_ALL_MAP_FILTERS,
    });
  });

  it.each(["ar=9-", "od=8-", "cs=4-", "played=DT", "used=2-", "last=2020-", "sort=title"])(
    "keeps an old link with %s on maps played in pools",
    (param) => {
      expect(parseSearchState(`tab=maps&${param}`)).toMatchObject({ scope: "played" });
    },
  );

  it("lets scope win, and reads a bad scope as unset", () => {
    expect(parseSearchState("tab=maps&scope=played")).toMatchObject({ scope: "played" });
    expect(parseSearchState("tab=maps&scope=all&ar=9-&sort=title")).toEqual({
      tab: "maps",
      scope: "all",
      page: 1,
      filters: EMPTY_ALL_MAP_FILTERS,
    });
    expect(parseSearchState("tab=maps&scope=every")).toMatchObject({ scope: "all" });
  });

  it("reads a status and Show explicit maps, and ignores a status it doesn't know", () => {
    expect(parseSearchState("tab=maps&status=graveyard&explicit=show")).toMatchObject({
      scope: "all",
      filters: { status: "graveyard", explicit: true },
    });
    expect(parseSearchState("tab=maps&status=wip&explicit=only")).toMatchObject({
      filters: { status: "ranked", explicit: false },
    });
  });

  it("reads an old status=any link as the default status", () => {
    expect(parseSearchState("tab=maps&status=any")).toMatchObject({
      filters: { status: "ranked" },
    });
  });

  it("writes scope=played for a played search and never scope=all", () => {
    const played: SearchState = {
      tab: "maps",
      scope: "played",
      page: 1,
      filters: EMPTY_MAP_FILTERS,
    };
    expect(serializeSearchState(played)).toBe("tab=maps&scope=played");
    const all: SearchState = { tab: "maps", scope: "all", page: 1, filters: EMPTY_ALL_MAP_FILTERS };
    expect(serializeSearchState(all)).toBe("tab=maps");
  });

  it("round-trips an all-maps search", () => {
    const state: SearchState = {
      tab: "maps",
      scope: "all",
      page: 3,
      filters: {
        q: "freedom dive",
        status: "loved",
        sr: [6.5, null],
        len: [60, 300],
        bpm: [200, null],
        explicit: true,
      },
    };
    const text = serializeSearchState(state);
    expect(text).toBe(
      "tab=maps&status=loved&sr=6.5-&len=60-300&bpm=200-&explicit=show&page=3&q=freedom%20dive",
    );
    expect(parseSearchState(text)).toEqual(state);
  });
});
