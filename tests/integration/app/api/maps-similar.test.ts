/**
 * @file tests/integration/app/api/maps-similar.test.ts
 * @desc GET /api/maps/<id>/similar against stand-in mirrors (msw): a map in similar_maps answered
 *       as a pattern match and cached like search; one that isn't as a difficulty match; mods
 *       read as the browser writes them; a pool id leaving the pool's maps out for its editor and
 *       never cached; a bad id 400; a failed mirror 503 similar_unavailable, no-store; and the
 *       per-IP search limit (60 a minute) then 429.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { setupMsw } from "@haruhimemoe/next-kit/testing";
import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/maps/[id]/similar/route";
import { BROWSE_LENSES } from "@/constants/browse";
import { MIRROR_BEATMAPS_URL, SIMILAR_FAILED } from "@/constants/similar";
import { resetLensList } from "@/lib/browse-lenses";
import { resetMirrorCooldown } from "@/lib/map-search";
import type { SimilarResponse } from "@/utils/similar-params";
import { ADMIN_OSU_ID } from "../../../helpers/auth";
import { setupTestDb } from "../../../helpers/db";
import { lensStats, lensStatsHandler, nekohaAnswer, nekohaHandler } from "../../../helpers/nekoha";
import { createCast, insertPool, params } from "../../../helpers/pool-requests";
import { ppBatchHandler, ppValues } from "../../../helpers/pp-batch";
import { beatmapRow, beatmapsHandler, rowsOf, seedSimilar } from "../../../helpers/similar";

setupTestDb();
const server = setupMsw();
beforeEach(() => {
  resetMirrorCooldown();
  resetLensList();
  vi.stubEnv("ADMIN_OSU_IDS", String(ADMIN_OSU_ID));
  server.use(
    lensStatsHandler(() => lensStats([...BROWSE_LENSES])),
    ppBatchHandler(() => ppValues({ stars: 6.1 })),
    beatmapsHandler(rowsOf([beatmapRow(1, 100), beatmapRow(11, 110), beatmapRow(21, 120)])),
    nekohaHandler(() => nekohaAnswer([], { mod: "NM", total: 0 })),
  );
});

const get = (id: string, query = "", { ip = "203.0.113.9", cookie = "" } = {}) =>
  GET(
    new Request(`http://localhost:3000/api/maps/${id}/similar${query ? `?${query}` : ""}`, {
      headers: { "x-real-ip": ip, ...(cookie ? { cookie } : {}) },
    }),
    params({ id }),
  );

const body = async (response: Response) => (await response.json()) as SimilarResponse;

describe("GET /api/maps/[id]/similar", () => {
  it("answers a pattern match, cached 5 minutes on the CDN", async () => {
    await seedSimilar(1, [
      { id: 21, score: 255 },
      { id: 11, score: 204 },
    ]);
    const response = await get("1", "mods=DT");
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("public, s-maxage=300");
    const answer = await body(response);
    expect(answer).toMatchObject({ id: 1, method: "pattern", lens: "DT", rev: "v14.1" });
    expect(
      answer.sets.flatMap((set) => set.diffs.map((d) => [d.id, d.similarity, d.stars])),
    ).toEqual([
      [21, 100, 6.1],
      [11, 80, 6.1],
    ]);
  });

  it("keeps only leaderboard maps with status=leaderboard", async () => {
    server.use(
      beatmapsHandler(
        rowsOf([
          beatmapRow(1, 100),
          beatmapRow(11, 110),
          beatmapRow(21, 120, { beatmapset: { status: "graveyard" } }),
        ]),
      ),
    );
    await seedSimilar(1, [
      { id: 21, score: 255 },
      { id: 11, score: 204 },
    ]);
    const all = await body(await get("1"));
    expect(all).toMatchObject({ unranked: 0, total: 2 });
    expect(all.sets.map((set) => set.setId)).toEqual([120, 110]);
    const response = await get("1", "status=leaderboard");
    expect(response.headers.get("cache-control")).toBe("public, s-maxage=300");
    const answer = await body(response);
    expect(answer).toMatchObject({ unranked: 1, total: 2 });
    expect(answer.sets.map((set) => set.setId)).toEqual([110]);
  });

  it("answers a difficulty match for a map not in the table", async () => {
    const response = await get("1");
    expect(response.status).toBe(200);
    expect(await body(response)).toMatchObject({ method: "difficulty", rev: null, sets: [] });
  });

  it("leaves the pool's maps out for its editor, never cached", async () => {
    await seedSimilar(1, [
      { id: 21, score: 255 },
      { id: 11, score: 204 },
    ]);
    const cast = await createCast();
    await insertPool(cast, { slots: [{ mod: "NM", index: 1, beatmapId: 21 }] });
    const response = await get("1", "pool=b-a0000001", { cookie: cast.editor.cookie });
    expect(response.headers.get("cache-control")).toBe("no-store");
    const answer = await body(response);
    expect(answer.excluded).toBe(1);
    expect(answer.sets.flatMap((set) => set.diffs.map((d) => d.id))).toEqual([11]);
    const stranger = await body(await get("1", "pool=b-a0000001", { cookie: cast.other.cookie }));
    expect(stranger.excluded).toBe(0);
  });

  it.each(["0", "abc", "-4", "99999999999"])("answers 400 for the id %s", async (id) => {
    const response = await get(id);
    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("answers 503 similar_unavailable, uncached, when the mirror fails", async () => {
    server.use(http.get(MIRROR_BEATMAPS_URL, () => HttpResponse.json({}, { status: 500 })));
    const response = await get("1");
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      error: { code: "similar_unavailable", message: SIMILAR_FAILED },
    });
  });

  it("allows 60 requests a minute per IP, then 429", async () => {
    for (let i = 0; i < 60; i++)
      expect((await get("1", "", { ip: "198.51.100.7" })).status).toBe(200);
    const refused = await get("1", "", { ip: "198.51.100.7" });
    expect(refused.status).toBe(429);
    expect(refused.headers.get("retry-after")).not.toBeNull();
    expect((await get("1", "", { ip: "198.51.100.8" })).status).toBe(200);
  });
});
