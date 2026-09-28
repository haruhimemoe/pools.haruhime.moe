/**
 * @file tests/integration/services/map-browse.test.ts
 * @desc The map browser against stand-in mirrors (msw) and the database: Ranked, Loved and
 *       Graveyard through the mirror's mod data (rows grouped by set, stars under the lens, BPM
 *       and length from the math, AR, OD and CS from pp/batch or the math with "math"), a lens
 *       the mirror doesn't list read as NM, Qualified and Pending through the all-maps search
 *       without mods; disallowed sets hidden and counted, compact graveyard sets "Check first";
 *       the pool's own maps, played maps and the BPM, length, AR and OD filters left out and
 *       counted; page counts; and every failure (the mirror's, ready false) as one.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

import { HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { BROWSE_LENSES } from "@/constants/browse";
import { SET_FACTS_COLLECTION } from "@/constants/db";
import { resetLensList } from "@/lib/browse-lenses";
import { getDb } from "@/lib/db";
import { resetMirrorCooldown } from "@/lib/map-search";
import { mapsCollection } from "@/models/Map";
import { browseMaps } from "@/services/map-browse";
import { type BrowseParams, DEFAULT_BROWSE_PARAMS } from "@/utils/browse-params";
import { setupTestDb } from "../../helpers/db";
import { compactSet, mirrorSearchHandler, searchAnswer } from "../../helpers/mirror-search";
import { setupMsw } from "../../helpers/msw";
import {
  lensStats,
  lensStatsHandler,
  type MirrorCall,
  nekohaAnswer,
  nekohaHandler,
  nekohaRow,
} from "../../helpers/nekoha";
import { type BatchCall, ppBatchAnswering, ppBatchHandler, ppValues } from "../../helpers/pp-batch";
import { makeMap } from "../../helpers/records";

setupTestDb();
const server = setupMsw();
beforeEach(() => {
  resetMirrorCooldown();
  resetLensList();
  server.use(lensStatsHandler(() => lensStats([...BROWSE_LENSES])));
});

/** pp/batch knows ids below 100 under DT and NM (AR 10.33, OD 9.78 under DT; AR 9, OD 8 NM). */
const batch = (calls: BatchCall[] = []) =>
  server.use(
    ppBatchHandler((id, mods) => {
      if (id >= 100) return undefined;
      if (mods === "DT") return ppValues({ stars: 6.2, ar: 10.333, od: 9.778, cs: 4, bpm: 270 });
      return mods === "NM" ? ppValues() : undefined;
    }, calls),
  );

const rows = (maps: unknown[], extra: Record<string, unknown> = {}, calls: MirrorCall[] = []) =>
  server.use(nekohaHandler(() => nekohaAnswer(maps, extra), calls));

const DT: BrowseParams = { ...DEFAULT_BROWSE_PARAMS, lens: "DT" };

const browse = async (params: BrowseParams = DT, deps = {}) => {
  const result = await browseMaps(params, deps);
  if (!result.ok) throw new Error("the browse failed");
  return result;
};

describe("browseMaps with the mirror's mod data", () => {
  it("groups rows by set with values under the lens", async () => {
    batch();
    rows(
      [nekohaRow(12, 1, { stars: 6.8, difficulty_rating: 5 }), nekohaRow(21, 2), nekohaRow(11, 1)],
      { total: 120 },
    );
    const { answer, cacheable } = await browse();
    expect(cacheable).toBe(true);
    expect(answer).toMatchObject({
      lens: "DT",
      lenses: [...BROWSE_LENSES],
      status: "ranked",
      page: 1,
      pageCount: 3,
      total: 120,
      hidden: 0,
      filteredOnPage: 0,
      excluded: 0,
      playedHidden: 0,
      modValuesAvailable: true,
    });
    expect(answer.sets.map((set) => [set.setId, set.diffs.map((diff) => diff.id)])).toEqual([
      [1, [11, 12]],
      [2, [21]],
    ]);
    expect(answer.sets[0]).toMatchObject({
      artist: "Compact Artist",
      title: "Xeroa",
      creator: "Mapper",
      status: "ranked",
      unranked: false,
      check: null,
    });
    expect(answer.sets[0]?.diffs[0]).toEqual({
      id: 11,
      version: "Diff 11",
      stars: 6.2,
      starsNoMod: 4.5,
      ar: 10.33,
      od: 9.78,
      cs: 4,
      bpm: 270,
      length: 80,
      playedIn: 0,
      source: "mirror",
    });
  });

  it("falls back to no-mod values and the math, marked math, when pp/batch lacks the lens", async () => {
    const calls: BatchCall[] = [];
    server.use(
      ppBatchHandler((id, mods) => (id === 21 && mods === "NM" ? ppValues() : undefined), calls),
    );
    rows([nekohaRow(21, 2), nekohaRow(150, 2)], { mod: "HRDT" });
    const { answer, cacheable } = await browse({ ...DT, lens: "HRDT" });
    expect(cacheable).toBe(true);
    expect(calls.map((call) => [call.mods, call.ids])).toEqual([
      ["HRDT", [21, 150]],
      ["NM", [21, 150]],
    ]);
    const [known, unknown] = answer.sets[0]?.diffs ?? [];
    expect(known).toMatchObject({ ar: 11, od: 11.11, cs: 5.2, bpm: 270, source: "math" });
    expect(unknown).toMatchObject({ ar: null, od: null, cs: null, bpm: 270, source: "math" });
  });

  it("asks with the lens, the status, the text, the star range, the sort and the page", async () => {
    batch();
    const calls: MirrorCall[] = [];
    rows([], { mod: "HDHR", total: 0 }, calls);
    const params: BrowseParams = {
      ...DEFAULT_BROWSE_PARAMS,
      lens: "HDHR",
      status: "loved",
      q: "xeroa",
      sr: [6, 7],
      sort: "bpm_desc",
      page: 2,
    };
    const { answer } = await browse(params);
    expect(Object.fromEntries(calls[0]?.url.searchParams ?? [])).toMatchObject({
      mods: "HDHR",
      status: "loved",
      q: "xeroa",
      min_stars: "6",
      max_stars: "7",
      sort: "bpm_desc",
      page: "2",
    });
    expect(answer).toMatchObject({ lens: "HDHR", page: 2, pageCount: 0, total: 0, sets: [] });
  });

  it("reads a lens the mirror doesn't list as NM", async () => {
    batch();
    server.use(lensStatsHandler(() => lensStats(["NM", "DT"])));
    const calls: MirrorCall[] = [];
    rows([nekohaRow(21, 2, { mod: "NM" })], { mod: "NM" }, calls);
    const { answer } = await browse({ ...DT, lens: "HDHRDT" });
    expect(calls[0]?.url.searchParams.get("mods")).toBe("NM");
    expect(answer).toMatchObject({ lens: "NM", lenses: ["NM", "DT"] });
    expect(answer.sets[0]?.diffs[0]).toMatchObject({ ar: 9, od: 8, bpm: 180, length: 120 });
  });
});

describe("browseMaps compliance", () => {
  it("hides and counts disallowed sets; compact graveyard sets check first unless facts decide", async () => {
    batch();
    const graveyard = { status: "graveyard" };
    rows([
      nekohaRow(11, 1),
      nekohaRow(21, 2, { artist: "Lusumi", title: "execution_program" }),
      nekohaRow(31, 3, graveyard),
      nekohaRow(41, 4, { ...graveyard, artist: "Igorrr" }),
    ]);
    await getDb()
      .collection(SET_FACTS_COLLECTION)
      .insertOne({
        _id: 4 as never,
        status: "graveyard",
        artist: "Igorrr",
        title: "Xeroa",
        artistUnicode: "Igorrr",
        titleUnicode: "Xeroa",
        source: "",
        tags: "",
        trackId: null,
        downloadDisabled: false,
        moreInformation: null,
        beatmapIds: [41],
        fetchedAt: new Date(),
      });
    const { answer } = await browse();
    expect(answer.hidden).toBe(2);
    expect(answer.sets.map((set) => [set.setId, set.unranked, set.check])).toEqual([
      [1, false, null],
      [3, true, { text: "Needs a closer look" }],
    ]);
  });
});

describe("browseMaps page filters", () => {
  it("leaves out the pool's own maps and counts them", async () => {
    batch();
    rows([nekohaRow(11, 1), nekohaRow(12, 1), nekohaRow(21, 2)]);
    const { answer } = await browse({ ...DT, excludeIds: [12, 21] });
    expect(answer.excluded).toBe(2);
    expect(answer.sets.map((set) => [set.setId, set.diffs.map((diff) => diff.id)])).toEqual([
      [1, [11]],
    ]);
  });

  it("says how many past pools played each map, and hides played ones when asked", async () => {
    batch();
    await (await mapsCollection()).insertOne(
      makeMap({ _id: 11, usage: { count: 3, lastYear: 2023, playedAs: ["DT"], shown: true } }),
    );
    rows([nekohaRow(11, 1), nekohaRow(12, 1)]);
    const shown = await browse();
    expect(shown.answer.sets[0]?.diffs.map((diff) => [diff.id, diff.playedIn])).toEqual([
      [11, 3],
      [12, 0],
    ]);
    const hidden = await browse({ ...DT, hidePlayed: true });
    expect(hidden.answer.playedHidden).toBe(1);
    expect(hidden.answer.sets[0]?.diffs.map((diff) => diff.id)).toEqual([12]);
  });

  it("filters AR, OD, BPM and length under the lens, and counts what it left out", async () => {
    batch();
    rows([nekohaRow(11, 1), nekohaRow(12, 1, { bpm: 200 }), nekohaRow(150, 2)]);
    const ar = await browse({ ...DT, ar: [10, 10.5] });
    expect(ar.answer.filteredOnPage).toBe(1);
    expect(ar.answer.sets.flatMap((set) => set.diffs.map((diff) => diff.id))).toEqual([11, 12]);
    const bpm = await browse({ ...DT, bpm: [280, null], od: [9.5, 10] });
    expect(bpm.answer.filteredOnPage).toBe(2);
    expect(bpm.answer.sets.flatMap((set) => set.diffs.map((diff) => diff.id))).toEqual([12]);
    const len = await browse({ ...DT, len: [90, null] });
    expect(len.answer.filteredOnPage).toBe(3);
    expect(len.answer.sets).toEqual([]);
  });

  it("answers null played counts, not to be cached, when that lookup fails", async () => {
    batch();
    rows([nekohaRow(11, 1)]);
    const { answer, cacheable } = await browse(DT, {
      playedCounts: async () => {
        throw new Error("maps lookup failed");
      },
    });
    expect(cacheable).toBe(false);
    expect(answer.sets[0]?.diffs[0]?.playedIn).toBeNull();
  });
});

describe("browseMaps without mod data (Qualified and Pending)", () => {
  it("searches all maps without mods and says mod values aren't available", async () => {
    const calls: BatchCall[] = [];
    batch(calls);
    const set = compactSet(7, 70, { status: "qualified" });
    const [map] = set.beatmaps as Record<string, unknown>[];
    const withValues = { ...map, id: 71, ar: 9.3, accuracy: 8.5, cs: 4.2 };
    server.use(
      mirrorSearchHandler(() =>
        searchAnswer([{ ...set, beatmaps: [map, withValues] }], { total_count: 1 }),
      ),
    );
    const { answer } = await browse({ ...DT, status: "qualified" });
    expect(answer).toMatchObject({
      lens: "NM",
      status: "qualified",
      pageCount: 1,
      total: 1,
      modValuesAvailable: false,
    });
    expect(answer.sets[0]).toMatchObject({
      setId: 7,
      unranked: true,
      check: { text: "Needs a closer look" },
    });
    expect(answer.sets[0]?.diffs).toEqual([
      expect.objectContaining({ id: 70, stars: 4.5, starsNoMod: 4.5, ar: 9, od: 8, cs: 4 }),
      expect.objectContaining({ id: 71, ar: 9.3, od: 8.5, cs: 4.2, bpm: 150, length: 90 }),
    ]);
    expect(calls.map((call) => [call.mods, call.ids])).toEqual([["NM", [70]]]);
  });

  it("fails when the all-maps search fails", async () => {
    server.use(mirrorSearchHandler(() => HttpResponse.json({ error: "x" }, { status: 503 })));
    expect(await browseMaps({ ...DT, status: "pending" })).toEqual({ ok: false });
  });
});

describe("browseMaps pages and failures", () => {
  it("answers a short last page with its page count", async () => {
    batch();
    rows([nekohaRow(11, 1)], { total: 51, page: 2 });
    const { answer } = await browse({ ...DT, page: 2 });
    expect(answer).toMatchObject({ page: 2, pageCount: 2, total: 51 });
  });

  it.each([
    ["ready false", () => nekohaAnswer([nekohaRow(11, 1)], { ready: false })],
    ["a 503", () => HttpResponse.json({ error: "busy" }, { status: 503 })],
    ["another lens", () => nekohaAnswer([nekohaRow(11, 1)], { mod: "NM" })],
  ])("fails on %s", async (_name, answer) => {
    server.use(nekohaHandler(answer));
    expect(await browseMaps(DT)).toEqual({ ok: false });
  });

  it("answers from the math, not to be cached, when pp/batch fails", async () => {
    rows([nekohaRow(11, 1)]);
    server.use(ppBatchAnswering(() => HttpResponse.json({ error: "x" }, { status: 500 })));
    const { answer, cacheable } = await browse();
    expect(cacheable).toBe(false);
    expect(answer.sets[0]?.diffs[0]).toMatchObject({ ar: null, bpm: 270, source: "math" });
  });
});
