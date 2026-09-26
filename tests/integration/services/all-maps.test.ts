/**
 * @file tests/integration/services/all-maps.test.ts
 * @desc Searching every osu! map against a stand-in mirror (msw) and the database: sets that
 *       can't be used in officially supported tournaments are hidden and counted (a graveyard
 *       set by a disallowed artist, a taken-down ranked set); a set that needs a closer look
 *       shows "Check first" with the package's wording; a compact ranked set is judged with no
 *       takedown notice (ok, or what an override says); any other compact set shows as potential
 *       unless a fresh setFacts row decides it; unranked sets carry the tag; each difficulty says how
 *       many pools played it (one maps lookup; null and not cacheable when it fails); a star
 *       range keeps the difficulties inside it (all of them when none are); a failed mirror is
 *       a failure.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sat Sep 26, 2026
 * @modified Sat Sep 26, 2026
 */

import { HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { SET_FACTS_COLLECTION } from "@/constants/db";
import { getDb } from "@/lib/db";
import { resetMirrorCooldown } from "@/lib/map-search";
import { mapsCollection } from "@/models/Map";
import { searchAllMaps } from "@/services/all-maps";
import { EMPTY_ALL_MAP_FILTERS } from "@/utils/search-params";
import { setupTestDb } from "../../helpers/db";
import {
  compactSet,
  fixtureSet,
  mirrorSearchHandler,
  searchAnswer,
} from "../../helpers/mirror-search";
import { setupMsw } from "../../helpers/msw";
import { makeMap } from "../../helpers/records";

setupTestDb();
const server = setupMsw();
beforeEach(resetMirrorCooldown);

const answering = (sets: unknown[], extra = {}) =>
  server.use(mirrorSearchHandler(() => searchAnswer(sets, extra)));

const search = async (filters = EMPTY_ALL_MAP_FILTERS, deps = {}) => {
  const result = await searchAllMaps(filters, 1, deps);
  if (!result.ok) throw new Error("the search failed");
  return result;
};

describe("searchAllMaps", () => {
  it("hides and counts sets that can't be used, and marks the rest", async () => {
    answering([fixtureSet(1), fixtureSet(101), fixtureSet(102), fixtureSet(103)], {
      total_count: 4,
    });
    const { answer, cacheable } = await search();
    expect(cacheable).toBe(true);
    expect(answer).toMatchObject({ page: 1, pageCount: 1, total: 4, hidden: 2 });
    expect(answer.results.map((set) => set.setId)).toEqual([1, 102]);
    expect(answer.results[0]).toMatchObject({ status: "ranked", unranked: false, check: null });
    expect(answer.results[1]).toMatchObject({
      status: "pending",
      unranked: true,
      check: { text: "Needs a closer look" },
    });
  });

  it("judges a compact ranked set with no badge, and a compact graveyard set as potential", async () => {
    answering([compactSet(510, 5100), compactSet(511, 5110, { status: "graveyard" })]);
    const { answer } = await search();
    expect(answer.results.map((set) => [set.setId, set.check])).toEqual([
      [510, null],
      [511, { text: "Needs a closer look" }],
    ]);
    expect(answer.hidden).toBe(0);
  });

  it("lets an override decide a compact ranked set", async () => {
    answering([
      compactSet(520, 5200, { artist: "Lusumi", title: "execution_program" }),
      compactSet(521, 5210),
    ]);
    const { answer } = await search();
    expect(answer.results.map((set) => set.setId)).toEqual([521]);
    expect(answer.hidden).toBe(1);
  });

  it("shows a compact unranked set as potential unless a fresh setFacts row decides it", async () => {
    const graveyard = { status: "graveyard" };
    answering([
      compactSet(500, 5000, graveyard),
      compactSet(501, 5010, graveyard),
      compactSet(502, 5020, graveyard),
    ]);
    const facts = (id: number, artist: string, fetchedAt: Date, status = "ranked") => ({
      _id: id as never,
      status,
      artist,
      title: "Compact Title",
      artistUnicode: artist,
      titleUnicode: "Compact Title",
      source: "",
      tags: "",
      trackId: null,
      downloadDisabled: false,
      moreInformation: null,
      beatmapIds: [id * 10],
      fetchedAt,
    });
    await getDb()
      .collection(SET_FACTS_COLLECTION)
      .insertMany([
        facts(501, "Compact Artist", new Date()),
        facts(502, "Igorrr", new Date(), "graveyard"),
        facts(500, "Compact Artist", new Date(Date.now() - 2 * 86_400_000), "graveyard"),
      ]);
    const { answer } = await search();
    expect(answer.results.map((set) => [set.setId, set.check])).toEqual([
      [500, { text: "Needs a closer look" }],
      [501, null],
    ]);
    expect(answer.hidden).toBe(1);
  });

  it("says how many pools played each difficulty", async () => {
    answering([fixtureSet(1)]);
    await (await mapsCollection()).insertOne(
      makeMap({ _id: 75, usage: { count: 3, lastYear: 2023, playedAs: ["NM"], shown: true } }),
    );
    const { answer } = await search();
    expect(answer.results[0]?.maps.map((map) => [map.id, map.playedIn])).toEqual([[75, 3]]);
  });

  it("answers null played counts, not to be cached, when that lookup fails", async () => {
    answering([fixtureSet(1)]);
    const { answer, cacheable } = await search(EMPTY_ALL_MAP_FILTERS, {
      playedCounts: async () => {
        throw new Error("maps lookup failed");
      },
    });
    expect(cacheable).toBe(false);
    expect(answer.results[0]?.maps[0]?.playedIn).toBeNull();
  });

  it("keeps the difficulties inside a star range, or all of them when none are", async () => {
    const set = {
      ...compactSet(600, 6000),
      beatmaps: [4, 5.5, 6.2, 7].map((stars, i) => ({
        id: 6000 + i,
        mode: "osu",
        version: `${stars}`,
        difficulty_rating: stars,
        total_length: 100,
        bpm: 170,
      })),
    };
    answering([set]);
    const inside = await search({ ...EMPTY_ALL_MAP_FILTERS, sr: [5, 6.5] });
    expect(inside.answer.results[0]?.maps.map((map) => map.stars)).toEqual([5.5, 6.2]);
    const none = await search({ ...EMPTY_ALL_MAP_FILTERS, sr: [8, null] });
    expect(none.answer.results[0]?.maps.map((map) => map.stars)).toEqual([4, 5.5, 6.2, 7]);
  });

  it("fails when the mirror does", async () => {
    server.use(mirrorSearchHandler(() => HttpResponse.json({ error: "down" }, { status: 503 })));
    expect(await searchAllMaps(EMPTY_ALL_MAP_FILTERS, 1)).toEqual({ ok: false });
  });
});
