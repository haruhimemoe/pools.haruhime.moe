/**
 * @file tests/integration/app/api/pool-activity.test.ts
 * @desc The activity log end to end: ops, visibility, editor and owner changes each record who,
 *       when, what; GET .../activity shows the last 20, newest first, to the owner and editors
 *       only (401 signed out, 404 for a private pool, 403 for others and admins on a public
 *       one); a pool keeps its last 200; the TTL index drops entries after 180 days; deleting
 *       the pool removes its entries, and deleting an account renames its entries elsewhere.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/pools/[id]/activity/route";
import { POST as postOps } from "@/app/api/pools/[id]/ops/route";
import { PUT as putVisibility } from "@/app/api/pools/[id]/visibility/route";
import { BUILT_POOL_ACTIVITY_INDEXES } from "@/constants/db";
import { builtPoolActivityCollection } from "@/models/BuiltPoolActivity";
import { removeUserFromBuiltPools } from "@/services/account";
import { recordActivity } from "@/services/built-pool-activity";
import { deleteBuiltPool } from "@/services/built-pools";
import { setupTestDb } from "../../../helpers/db";
import {
  type Cast,
  createCast,
  insertPool,
  params,
  poolRequest,
} from "../../../helpers/pool-requests";

setupTestDb();

const ID = "b-a0000001";
const read = (cast: Cast, who: keyof Cast | null = "owner") =>
  GET(
    poolRequest("GET", `/api/pools/${ID}/activity`, who ? cast[who].cookie : null),
    params({ id: ID }),
  );
type Entry = { username: string; kind: string; summary: string; osuId: number | null };
const entries = async (response: Response) =>
  ((await response.json()) as { activity: Entry[] }).activity;

describe("the activity log", () => {
  it("records ops and visibility with who made them, newest first", async () => {
    const cast = await createCast();
    await insertPool(cast, { _id: ID });
    const ops = { baseVersion: 1, ops: [{ type: "addMap", beatmapId: 5, bucket: "HD" }] };
    await postOps(
      poolRequest("POST", `/api/pools/${ID}/ops`, cast.editor.cookie, ops),
      params({ id: ID }),
    );
    const body = { visibility: "unlisted" };
    await putVisibility(
      poolRequest("PUT", `/api/pools/${ID}/visibility`, cast.owner.cookie, body),
      params({ id: ID }),
    );
    const response = await read(cast, "editor");
    expect(response.status).toBe(200);
    expect(await entries(response)).toMatchObject([
      { username: "owner", osuId: 10, kind: "visibility", summary: "Made the pool unlisted" },
      { username: "editor", osuId: 20, kind: "add", summary: "Added beatmap 5 to HD1" },
    ]);
  });

  it("shows it to the owner and editors only", async () => {
    const cast = await createCast();
    await insertPool(cast, { _id: ID, visibility: "public" });
    expect((await read(cast, null)).status).toBe(401);
    expect((await read(cast, "other")).status).toBe(403);
    expect((await read(cast, "admin")).status).toBe(403);
    await (await builtPoolActivityCollection()).deleteMany({});
    await insertPool(cast, { _id: "b-a0000002" });
    const privateRead = GET(
      poolRequest("GET", "/api/pools/b-a0000002/activity", cast.other.cookie),
      params({ id: "b-a0000002" }),
    );
    expect((await privateRead).status).toBe(404);
  });

  it("keeps a pool's last 200 and shows the last 20", async () => {
    const cast = await createCast();
    await insertPool(cast, { _id: ID });
    const start = Date.UTC(2026, 8, 28);
    for (let i = 0; i < 205; i++) {
      await recordActivity(
        ID,
        { osuId: 10, username: "owner" },
        { kind: "note", summary: `n${i}` },
        new Date(start + i * 1000),
      );
    }
    const log = await builtPoolActivityCollection();
    expect(await log.countDocuments({ poolId: ID })).toBe(200);
    expect(await log.countDocuments({ poolId: ID, summary: "n4" })).toBe(0);
    const shown = await entries(await read(cast));
    expect(shown).toHaveLength(20);
    expect(shown[0]?.summary).toBe("n204");
    const indexes = await log.indexes();
    const ttl = indexes.find((index) => index.name === BUILT_POOL_ACTIVITY_INDEXES.ttl);
    expect(ttl?.expireAfterSeconds).toBe(180 * 24 * 60 * 60);
  });

  it("goes with the pool, and a deleted account's entries say deleted user", async () => {
    const cast = await createCast();
    await insertPool(cast, { _id: ID });
    await insertPool(cast, { _id: "b-a0000002", ownerId: cast.other.id });
    await recordActivity(ID, { osuId: 10, username: "owner" }, { kind: "note", summary: "x" });
    await recordActivity(
      "b-a0000002",
      { osuId: 20, username: "editor" },
      { kind: "note", summary: "y" },
    );
    await deleteBuiltPool(ID, { id: cast.owner.id, osuId: 10, isAdmin: false });
    const log = await builtPoolActivityCollection();
    expect(await log.countDocuments({ poolId: ID })).toBe(0);
    await removeUserFromBuiltPools({ id: cast.editor.id, osuId: 20 });
    expect(await log.findOne({ poolId: "b-a0000002" })).toMatchObject({
      osuId: null,
      username: "deleted user",
    });
  });
});
