/**
 * @file tests/integration/services/similar-maps.test.ts
 * @desc Find similar against stand-in mirrors (msw) and the database: a similar_maps row read,
 *       its maps loaded in one mirror call and kept in order with their similarity ("pattern
 *       match"); values under the lens; disallowed sets hidden, the star range and the pool's
 *       maps (for its editors only) left out and counted; neighbors the mirror lacks counted; an
 *       empty table falling back to "difficulty match" (closest by stars, BPM, length, AR, OD,
 *       CS; never the map's own set; nothing for other modes); a failed mirror as a failure.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { setupMsw } from "@haruhimemoe/next-kit/testing";
import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { BROWSE_LENSES } from "@/constants/browse";
import { MIRROR_BEATMAPS_URL } from "@/constants/similar";
import { resetLensList } from "@/lib/browse-lenses";
import { resetMirrorCooldown } from "@/lib/map-search";
import { findSimilarMaps } from "@/services/similar-maps";
import type { SimilarQuery } from "@/utils/similar-params";
import { setupTestDb } from "../../helpers/db";
import {
  lensStats,
  lensStatsHandler,
  type MirrorCall,
  nekohaAnswer,
  nekohaHandler,
  nekohaRow,
} from "../../helpers/nekoha";
import { createCast, insertPool } from "../../helpers/pool-requests";
import { ppBatchHandler, ppValues } from "../../helpers/pp-batch";
import { beatmapRow, beatmapsHandler, rowsOf, seedSimilar } from "../../helpers/similar";

setupTestDb();
const server = setupMsw();
beforeEach(() => {
  resetMirrorCooldown();
  resetLensList();
  server.use(
    lensStatsHandler(() => lensStats([...BROWSE_LENSES])),
    // Under DT the mirror has ids below 100: 6.5 stars, AR 10.33.
    ppBatchHandler((id, mods) =>
      mods === "DT" && id < 100 ? ppValues({ stars: 6.5, ar: 10.33, od: 9.75 }) : undefined,
    ),
  );
});

const NM: SimilarQuery = { lens: "NM", sr: null, pool: null };

const MIRROR = rowsOf([
  beatmapRow(1, 100),
  beatmapRow(11, 110),
  beatmapRow(12, 110),
  beatmapRow(21, 120, { difficulty_rating: 7.2 }),
  beatmapRow(31, 130, { beatmapset: { artist: "Lusumi", title: "execution_program" } }),
  beatmapRow(41, 140, { mode: "taiko" }),
  beatmapRow(51, 150, { beatmapset: { status: "graveyard" } }),
]);

const similar = async (id: number, query: SimilarQuery = NM, caller = null as never) => {
  const result = await findSimilarMaps(id, query, caller);
  if (!result.ok) throw new Error("the lookup failed");
  return result;
};

describe("findSimilarMaps with a similar_maps row", () => {
  it("keeps the neighbors' order and similarity, grouped by set, in one mirror call", async () => {
    const calls: number[][] = [];
    server.use(beatmapsHandler(MIRROR, calls));
    await seedSimilar(1, [
      { id: 12, score: 250 },
      { id: 21, score: 230 },
      { id: 11, score: 220 },
    ]);
    const { answer, cacheable } = await similar(1);
    expect(cacheable).toBe(true);
    expect(calls).toEqual([[1, 12, 21, 11]]);
    expect(answer).toMatchObject({
      id: 1,
      method: "pattern",
      rev: "v14.1",
      lens: "NM",
      source: { setId: 100, artist: "Artist 100", title: "Song 100", version: "Diff 1" },
      hidden: 0,
      excluded: 0,
      filtered: 0,
      missing: 0,
    });
    expect(
      answer.sets.map((set) => [set.setId, set.diffs.map((d) => [d.id, d.similarity])]),
    ).toEqual([
      [
        110,
        [
          [12, 98],
          [11, 86],
        ],
      ],
      [120, [[21, 90]]],
    ]);
    expect(answer.sets[0]?.diffs[0]).toMatchObject({
      ar: 9,
      od: 8,
      cs: 4,
      stars: 5.5,
      playedIn: 0,
    });
  });

  it("gives values under the lens and filters by the star range under it", async () => {
    server.use(beatmapsHandler(MIRROR));
    await seedSimilar(1, [
      { id: 11, score: 250 },
      { id: 121, score: 240 },
    ]);
    server.use(beatmapsHandler(rowsOf([...MIRROR.values(), beatmapRow(121, 121)])));
    const { answer } = await similar(1, { lens: "DT", sr: [6, 7], pool: null });
    expect(answer.lens).toBe("DT");
    expect(answer.filtered).toBe(1);
    expect(answer.sets.flatMap((set) => set.diffs)).toMatchObject([
      { id: 11, stars: 6.5, starsNoMod: 5.5, ar: 10.33, bpm: 270, length: 80, source: "mirror" },
    ]);
  });

  it("hides disallowed sets, counts maps the mirror lacks or that aren't osu!standard", async () => {
    server.use(beatmapsHandler(MIRROR));
    await seedSimilar(1, [
      { id: 31, score: 250 },
      { id: 41, score: 240 },
      { id: 999, score: 230 },
      { id: 51, score: 220 },
    ]);
    const { answer } = await similar(1);
    expect(answer).toMatchObject({ hidden: 1, missing: 2 });
    expect(answer.sets.map((set) => [set.setId, set.unranked, set.check?.text])).toEqual([
      [150, true, "Needs a closer look"],
    ]);
  });

  it("leaves the pool's maps out for its editors only", async () => {
    server.use(beatmapsHandler(MIRROR));
    await seedSimilar(1, [
      { id: 11, score: 250 },
      { id: 21, score: 240 },
    ]);
    const cast = await createCast();
    await insertPool(cast, { slots: [{ mod: "NM", index: 1, beatmapId: 21 }] });
    const query = { ...NM, pool: "b-a0000001" };
    const asEditor = await findSimilarMaps(1, query, { ...cast.editor, isAdmin: false });
    expect(asEditor.ok && asEditor.answer.excluded).toBe(1);
    expect(asEditor.ok && asEditor.cacheable).toBe(false);
    const asOther = await findSimilarMaps(1, query, { ...cast.other, isAdmin: false });
    expect(asOther.ok && asOther.answer.excluded).toBe(0);
    expect((await findSimilarMaps(1, query, null)).ok).toBe(true);
  });
});

describe("findSimilarMaps fallback", () => {
  it("falls back to a difficulty match while the table is empty", async () => {
    const calls: MirrorCall[] = [];
    server.use(
      beatmapsHandler(MIRROR),
      nekohaHandler(
        () =>
          nekohaAnswer(
            [
              nekohaRow(61, 160, { mod: "NM", stars: 5.5, difficulty_rating: 5.5, bpm: 240 }),
              nekohaRow(62, 100, { mod: "NM", stars: 5.5, difficulty_rating: 5.5 }),
              nekohaRow(71, 170, { mod: "NM", stars: 5.6, difficulty_rating: 5.6, bpm: 180 }),
            ],
            { mod: "NM" },
          ),
        calls,
      ),
      ppBatchHandler((id) =>
        ppValues({ stars: id === 71 ? 5.6 : 5.5, bpm: id === 61 ? 240 : 180 }),
      ),
    );
    const { answer } = await similar(1);
    expect(answer).toMatchObject({ method: "difficulty", rev: null, missing: 0 });
    expect(answer.sets.flatMap((set) => set.diffs.map((d) => d.id))).toEqual([71, 61]);
    const [closest, farther] = answer.sets.flatMap((set) => set.diffs);
    expect(closest?.similarity).toBeGreaterThan(farther?.similarity ?? 100);
    expect(Object.fromEntries(calls[0]?.url.searchParams ?? [])).toMatchObject({
      mods: "NM",
      status: "ranked",
      min_stars: "5.2",
      max_stars: "5.8",
    });
  });

  it("has no fallback for other modes or maps the mirror lacks", async () => {
    server.use(beatmapsHandler(MIRROR));
    expect((await similar(41)).answer).toMatchObject({ method: "difficulty", sets: [] });
    expect((await similar(999)).answer).toMatchObject({ source: null, sets: [] });
  });

  it("fails when the mirror fails", async () => {
    server.use(http.get(MIRROR_BEATMAPS_URL, () => HttpResponse.json({}, { status: 502 })));
    expect((await findSimilarMaps(1, NM, null)).ok).toBe(false);
    resetMirrorCooldown();
    server.use(
      beatmapsHandler(MIRROR),
      nekohaHandler(() => nekohaAnswer([], { ready: false })),
    );
    expect((await findSimilarMaps(1, NM, null)).ok).toBe(false);
  });
});
