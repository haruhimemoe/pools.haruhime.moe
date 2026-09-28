/**
 * @file tests/unit/utils/browse-params.test.ts
 * @desc The map browser's params: defaults, every param read, anything unreadable (an unknown
 *       lens, status or sort, crossed ranges, bad pages, bad or too many excluded ids) falling to its
 *       default, lenses read in any order with NC as DT, excluded ids kept once and sorted, and
 *       the URL round trip in a fixed order.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

import { describe, expect, it } from "vitest";
import {
  type BrowseParams,
  browseApiUrl,
  DEFAULT_BROWSE_PARAMS,
  parseBrowseParams,
  serializeBrowseParams,
} from "@/utils/browse-params";

const FULL: BrowseParams = {
  q: "camellia",
  lens: "HDDT",
  status: "loved",
  sort: "stars_desc",
  sr: [5.5, 6.5],
  bpm: [180, null],
  len: [60, 240],
  ar: [9.5, 10.5],
  od: [0, 9],
  excludeIds: [75, 129891],
  hidePlayed: true,
  explicit: true,
  page: 3,
};

describe("parseBrowseParams", () => {
  it("reads nothing as the defaults", () => {
    expect(parseBrowseParams("")).toEqual(DEFAULT_BROWSE_PARAMS);
    expect(DEFAULT_BROWSE_PARAMS).toMatchObject({
      lens: "NM",
      status: "ranked",
      sort: "favourites_desc",
      page: 1,
    });
  });

  it("reads every param", () => {
    expect(
      parseBrowseParams(
        "?q=+camellia+&lens=HDDT&status=loved&sort=stars_desc&sr=5.5-6.5&bpm=180-&len=1:00-4:00&ar=9.5-10.5&od=-9&excludeIds=129891,75&hidePlayed=1&explicit=show&page=3",
      ),
    ).toEqual(FULL);
  });

  it.each([
    ["dthd", "HDDT"],
    ["NC", "DT"],
    ["hdhrnc", "HDHRDT"],
    ["HTEZ", "EZHT"],
    ["NM", "NM"],
  ])("reads the lens %j as %s", (raw, lens) => {
    expect(parseBrowseParams(`lens=${raw}`).lens).toBe(lens);
  });

  it.each(["HDFL", "EZHR", "XX", "HDHRDTFL", ""])("reads the lens %j as NM", (raw) => {
    expect(parseBrowseParams(`lens=${raw}`).lens).toBe("NM");
  });

  it.each(["favourites_desc", "pp", "stars_desc", "bpm_desc", "length_desc"])(
    "reads the sort %s",
    (sort) => {
      expect(parseBrowseParams(`sort=${sort}`).sort).toBe(sort);
    },
  );

  it("reads unknown statuses, sorts, bad ranges and bad pages as the defaults", () => {
    expect(
      parseBrowseParams(
        "status=any&sort=plays&sr=7-5&bpm=fast&ar=x&od=11-2&len=--&page=0&hidePlayed=yes",
      ),
    ).toEqual(DEFAULT_BROWSE_PARAMS);
    expect(parseBrowseParams("page=999").page).toBe(200);
  });

  it("keeps each excluded id once, sorted", () => {
    expect(parseBrowseParams("excludeIds=5,3,5,1").excludeIds).toEqual([1, 3, 5]);
  });

  it.each([
    ["a bad id", "excludeIds=1,x,3"],
    ["an empty part", "excludeIds=1,,3"],
    ["a zero", "excludeIds=0"],
    ["65 ids", `excludeIds=${Array.from({ length: 65 }, (_, i) => i + 1).join(",")}`],
    ["an 11-digit id", "excludeIds=12345678901"],
  ])("reads %s in excludeIds as none", (_name, query) => {
    expect(parseBrowseParams(query).excludeIds).toEqual([]);
  });

  it("takes 64 excluded ids, and 65 written with repeats", () => {
    const ids = Array.from({ length: 64 }, (_, i) => i + 1);
    expect(parseBrowseParams(`excludeIds=${ids.join(",")},1`).excludeIds).toEqual(ids);
  });

  it("cuts the text to 100 characters", () => {
    expect(parseBrowseParams(`q=${"a".repeat(150)}`).q).toHaveLength(100);
  });
});

describe("serializeBrowseParams", () => {
  it("writes nothing for the defaults", () => {
    expect(serializeBrowseParams(DEFAULT_BROWSE_PARAMS)).toBe("");
    expect(browseApiUrl(DEFAULT_BROWSE_PARAMS)).toBe("/api/maps/browse");
  });

  it("writes every param in a fixed order, the text last", () => {
    expect(serializeBrowseParams(FULL)).toBe(
      "lens=HDDT&status=loved&sort=stars_desc&sr=5.5-6.5&bpm=180-&len=60-240&ar=9.5-10.5&od=0-9&excludeIds=75,129891&hidePlayed=1&explicit=show&page=3&q=camellia",
    );
    expect(browseApiUrl({ ...DEFAULT_BROWSE_PARAMS, lens: "HR" })).toBe("/api/maps/browse?lens=HR");
  });

  it("round-trips through the URL", () => {
    expect(parseBrowseParams(serializeBrowseParams(FULL))).toEqual(FULL);
    const typed = { ...DEFAULT_BROWSE_PARAMS, q: "C++ & 100% ＯＷＣ?" };
    expect(parseBrowseParams(serializeBrowseParams(typed))).toEqual(typed);
  });

  it("writes a lone surrogate in the text as U+FFFD instead of throwing", () => {
    const query = serializeBrowseParams({ ...DEFAULT_BROWSE_PARAMS, q: "a\uD800b" });
    expect(parseBrowseParams(query).q).toBe("a�b");
  });
});
