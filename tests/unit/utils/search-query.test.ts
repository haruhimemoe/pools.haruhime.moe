/**
 * @file tests/unit/utils/search-query.test.ts
 * @desc Search queries: every public query starts with the visible / used filter, hints the
 *       index behind its sort, pages 50 at a time and runs under maxTimeMS; typed text becomes
 *       escaped, folded substrings (every term must match); ranges are inclusive with open
 *       slider edges; pools' stars are an overlap over complete stats; and a set range with
 *       missing values builds the "hidden, data missing" count query.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Mon Sep 28, 2026
 */

import { describe, expect, it } from "vitest";
import { BUILT_POOL_INDEXES, MAP_INDEXES, POOL_INDEXES } from "@/constants/db";
import { EMPTY_MAP_FILTERS, EMPTY_POOL_FILTERS } from "@/utils/search-filters";
import { builtPoolQuery, builtSearchable, mapQuery, poolQuery } from "@/utils/search-query";

describe("builtPoolQuery", () => {
  it("lists public pools with maps that moderators haven't hidden, by year, 50 a page", () => {
    expect(builtPoolQuery(EMPTY_POOL_FILTERS, 2, null)).toEqual({
      filter: {
        $and: [{ visibility: "public" }, { hidden: false }, { "slots.0": { $exists: true } }],
      },
      missing: null,
      sort: { year: -1, _id: 1 },
      hint: BUILT_POOL_INDEXES.searchYear,
      skip: 50,
      limit: 50,
      maxTimeMS: 2000,
    });
  });

  it("matches folded text, a contained map, map count and year, by name or map count", () => {
    const filters = {
      ...EMPTY_POOL_FILTERS,
      q: "Café",
      maps: [10, 20] as const,
      year: [2024, null] as const,
      sort: "name" as const,
    };
    const query = builtPoolQuery(filters, 1, 75);
    expect(query.filter).toEqual({
      $and: [
        { visibility: "public" },
        { hidden: false },
        { "slots.0": { $exists: true } },
        { searchText: { $regex: "cafe" } },
        { "slots.beatmapId": 75 },
        { mapCount: { $gte: 10, $lte: 20 } },
        { year: { $gte: 2024 } },
      ],
    });
    expect(query.missing).not.toBeNull();
    expect(query).toMatchObject({
      sort: { sortName: 1, _id: 1 },
      hint: BUILT_POOL_INDEXES.searchName,
    });
    const maps = builtPoolQuery({ ...EMPTY_POOL_FILTERS, sort: "maps" }, 1, null);
    expect(maps).toMatchObject({
      sort: { mapCount: -1, _id: 1 },
      hint: BUILT_POOL_INDEXES.searchMaps,
    });
  });

  it("can't take badged or a star range: built pools have neither", () => {
    expect(builtSearchable(EMPTY_POOL_FILTERS)).toBe(true);
    expect(builtSearchable({ ...EMPTY_POOL_FILTERS, badged: "yes" })).toBe(false);
    expect(builtSearchable({ ...EMPTY_POOL_FILTERS, sr: [5, null] })).toBe(false);
  });
});

describe("poolQuery", () => {
  it("lists visible pools newest first, 50 a page, under maxTimeMS", () => {
    expect(poolQuery(EMPTY_POOL_FILTERS, 3, null)).toEqual({
      filter: { $and: [{ visible: true }] },
      missing: null,
      sort: { year: -1, _id: 1 },
      hint: POOL_INDEXES.year,
      skip: 100,
      limit: 50,
      maxTimeMS: 2000,
    });
  });

  it("matches every folded term as plain text, and the other filters", () => {
    const query = poolQuery(
      { ...EMPTY_POOL_FILTERS, q: "Café (20k-10k)", badged: "no", maps: [10, null], sort: "name" },
      1,
      129891,
    );
    expect(query.filter).toEqual({
      $and: [
        { visible: true },
        { searchText: { $regex: "cafe" } },
        { searchText: { $regex: "\\(20k-10k\\)" } },
        { badged: false },
        { "slots.beatmapId": 129891 },
        { "stats.count": { $gte: 10 } },
      ],
    });
    expect(query.hint).toBe(POOL_INDEXES.name);
    expect(
      poolQuery({ ...EMPTY_POOL_FILTERS, badged: "unknown" }, 1, null).filter.$and,
    ).toContainEqual({ badged: null });
  });

  it("overlaps stars over complete stats and counts pools with missing data", () => {
    const query = poolQuery({ ...EMPTY_POOL_FILTERS, sr: [5.5, 6.5], year: [2019, null] }, 1, null);
    const stars = {
      "stats.complete": true,
      "stats.srMax": { $gte: 5.5 },
      "stats.srMin": { $lte: 6.5 },
    };
    const year = { year: { $gte: 2019 } };
    expect(query.filter).toEqual({ $and: [{ visible: true }, year, stars] });
    expect(query.missing).toEqual({
      $and: [
        { visible: true },
        { $or: [year, { year: null }] },
        { $or: [stars, { "stats.complete": false }] },
        { $or: [{ year: null }, { "stats.complete": false }] },
      ],
    });
  });

  it("leaves an open slider edge unbounded", () => {
    expect(poolQuery({ ...EMPTY_POOL_FILTERS, sr: [0, 6] }, 1, null).filter.$and).toContainEqual({
      "stats.complete": true,
      "stats.srMin": { $lte: 6 },
    });
  });
});

describe("mapQuery", () => {
  it("lists maps some current pool uses, most used first", () => {
    expect(mapQuery(EMPTY_MAP_FILTERS, 1)).toMatchObject({
      filter: { $and: [{ "usage.count": { $gte: 1 } }] },
      missing: null,
      sort: { "usage.count": -1, _id: 1 },
      hint: MAP_INDEXES.used,
      skip: 0,
    });
  });

  it("needs every ticked code, and counts maps missing a ranged value", () => {
    const query = mapQuery(
      {
        ...EMPTY_MAP_FILTERS,
        played: ["NM", "DT"],
        sr: [6, null],
        last: [2020, 2022],
        sort: "stars",
      },
      1,
    );
    expect(query.filter).toEqual({
      $and: [
        { "usage.count": { $gte: 1 } },
        { "usage.playedAs": { $all: ["NM", "DT"] } },
        { stars: { $gte: 6 } },
        { "usage.lastYear": { $gte: 2020, $lte: 2022 } },
      ],
    });
    expect(query.missing).not.toBeNull();
    expect(query.hint).toBe(MAP_INDEXES.stars);
    expect(query.sort).toEqual({ stars: -1, _id: 1 });
  });

  it("builds length, BPM, AR, OD and CS on their own fields, and counts maps missing any", () => {
    const query = mapQuery(
      {
        ...EMPTY_MAP_FILTERS,
        len: [90, 180],
        bpm: [180, null],
        ar: [9, null],
        od: [0, 8],
        cs: [4, 4.5],
      },
      1,
    );
    expect(query.filter).toEqual({
      $and: [
        { "usage.count": { $gte: 1 } },
        { length: { $gte: 90, $lte: 180 } },
        { bpm: { $gte: 180 } },
        { ar: { $gte: 9 } },
        { od: { $lte: 8 } },
        { cs: { $gte: 4, $lte: 4.5 } },
      ],
    });
    expect(query.missing?.$and.at(-1)).toEqual({
      $or: [{ length: null }, { bpm: null }, { ar: null }, { od: null }, { cs: null }],
    });
  });

  it.each([
    ["last", { "usage.lastYear": -1, _id: 1 }, MAP_INDEXES.last],
    ["length", { length: -1, _id: 1 }, MAP_INDEXES.length],
    ["title", { sortTitle: 1, _id: 1 }, MAP_INDEXES.title],
  ] as const)("sorts by %s on its index", (sort, order, hint) => {
    expect(mapQuery({ ...EMPTY_MAP_FILTERS, sort }, 1)).toMatchObject({ sort: order, hint });
  });
});
