/**
 * @file tests/integration/app/api/pool-maps.test.ts
 * @desc GET /api/pools/<id>/maps: the owner and editors get every map's details, with maps pools
 *       never saw filled from the mirror (msw) and stored with no usage, so they count toward no
 *       pool and get no map page; a map the mirror doesn't have comes back blank. Signed out 401,
 *       can't see it 404, sees it but can't edit 403. Never cached.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/pools/[id]/maps/route";
import { builtPoolsCollection } from "@/models/BuiltPool";
import { mapsCollection } from "@/models/Map";
import { ADMIN_OSU_ID } from "../../../helpers/auth";
import { setupTestDb } from "../../../helpers/db";
import { mirrorHandler, mirrorRow } from "../../../helpers/hinai-server";
import { setupMsw } from "../../../helpers/msw";
import { createCast, insertPool, params, poolRequest } from "../../../helpers/pool-requests";
import { makeMap } from "../../../helpers/records";

const SEED = {
  setId: 77,
  artist: "xi",
  title: "Blue Zenith",
  setHost: "Asphyxia",
  version: "FOUR DIMENSIONS",
  ar: 9.6,
  od: 9,
  cs: 4,
  hp: 6,
  length: 212,
  bpm: 200,
};

setupTestDb();
setupMsw(mirrorHandler(new Map([[200, mirrorRow(200, SEED, 7.1)]])));
beforeEach(() => {
  vi.stubEnv("ADMIN_OSU_IDS", String(ADMIN_OSU_ID));
});

const ID = "b-a0000001";
const SLOTS = [100, 200, 300].map((beatmapId, i) => ({ mod: "NM", index: i + 1, beatmapId }));
const ask = (cookie: string | null) =>
  GET(poolRequest("GET", `/api/pools/${ID}/maps`, cookie), params({ id: ID }));

describe("GET /api/pools/<id>/maps", () => {
  it("fills maps pools never saw, leaves them out of usage, and answers every map", async () => {
    const cast = await createCast();
    await insertPool(cast, { slots: SLOTS });
    await (await mapsCollection()).insertOne(makeMap({ _id: 100 }));
    const response = await ask(cast.editor.cookie);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    const body = (await response.json()) as { maps: { id: number }[]; error: string | null };
    expect(body.error).toBeNull();
    const byId = new Map(body.maps.map((map) => [map.id, map]));
    expect(byId.get(100)).toMatchObject({
      title: "Title 100",
      usage: { count: 1, lastYear: 2020 },
    });
    expect(byId.get(200)).toMatchObject({
      artist: "xi",
      title: "Blue Zenith",
      version: "FOUR DIMENSIONS",
      setHost: "Asphyxia",
      stars: 7.1,
      usage: { count: 0, lastYear: null },
    });
    expect(byId.get(300)).toMatchObject({ title: null, stars: null });
    const stored = await (await mapsCollection()).findOne({ _id: 200 });
    expect(stored?.usage).toEqual({ count: 0, lastYear: null, playedAs: [], shown: false });
  });

  it("answers 401, 404 and 403 to everyone else", async () => {
    const cast = await createCast();
    await insertPool(cast, { slots: SLOTS });
    expect((await ask(null)).status).toBe(401);
    expect((await ask(cast.other.cookie)).status).toBe(404);
    expect((await ask(cast.admin.cookie)).status).toBe(404);
    await (await builtPoolsCollection()).updateOne({ _id: ID }, { $set: { visibility: "public" } });
    expect((await ask(cast.other.cookie)).status).toBe(403);
    expect((await ask(cast.admin.cookie)).status).toBe(403);
    expect((await ask(cast.owner.cookie)).status).toBe(200);
  });
});
