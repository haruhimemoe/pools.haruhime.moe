/**
 * @file tests/integration/app/api/pool-plan.test.ts
 * @desc What a built pool plans besides its maps, through the routes: setTarget stores a
 *       bucket's target (the owner's or an editor's; never someone else's), sends it back in the
 *       view, clears it, and drops it with its bucket (the field goes when none are left); a
 *       new pool from a template gets its counts as targets and no maps; starting from a built
 *       pool copies its targets.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { describe, expect, it } from "vitest";
import { POST as postOps } from "@/app/api/pools/[id]/ops/route";
import { GET as getPool } from "@/app/api/pools/[id]/route";
import { POST as create } from "@/app/api/pools/route";
import { builtPoolsCollection } from "@/models/BuiltPool";
import { findBuiltPool } from "@/services/built-pools";
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

const send = (cast: Cast, baseVersion: number, ops: unknown[], who: keyof Cast = "owner") =>
  postOps(
    poolRequest("POST", `/api/pools/${ID}/ops`, cast[who].cookie, { baseVersion, ops }),
    params({ id: ID }),
  );

type PoolBody = { pool: { version: number; targets: unknown } };

describe("setTarget", () => {
  it("stores a target, sends it in the view, clears it, and drops it with its bucket", async () => {
    const cast = await createCast();
    await insertPool(cast, { _id: ID });
    const set = await send(
      cast,
      1,
      [
        { type: "addBucket", code: "EZ" },
        { type: "setTarget", bucket: "NM", count: 5, sr: { min: 5.8, max: 6.3 } },
        { type: "setTarget", bucket: "EZ", count: 2 },
      ],
      "editor",
    );
    expect(set.status).toBe(200);
    expect(((await set.json()) as PoolBody).pool.targets).toEqual({
      NM: { count: 5, sr: { min: 5.8, max: 6.3 } },
      EZ: { count: 2 },
    });
    await send(cast, 2, [{ type: "removeBucket", code: "EZ" }]);
    expect((await findBuiltPool(ID))?.targets).toEqual({
      NM: { count: 5, sr: { min: 5.8, max: 6.3 } },
    });
    const cleared = await send(cast, 3, [{ type: "setTarget", bucket: "NM", count: 0 }]);
    expect(((await cleared.json()) as PoolBody).pool.targets).toEqual({});
    const row = await (await builtPoolsCollection()).findOne({ _id: ID });
    expect(row && "targets" in row).toBe(false);
  });

  it("refuses someone who isn't an owner or editor, and a bucket the pool lacks", async () => {
    const cast = await createCast();
    await insertPool(cast, { _id: ID, visibility: "public" });
    const op = { type: "setTarget", bucket: "NM", count: 5 };
    expect((await send(cast, 1, [op], "other")).status).toBe(403);
    expect((await send(cast, 1, [op], "admin")).status).toBe(403);
    const missing = await send(cast, 1, [{ ...op, bucket: "EZ" }]);
    expect(missing.status).toBe(400);
    expect((await findBuiltPool(ID))?.targets).toBeUndefined();
  });
});

describe("templates and starting from a pool", () => {
  it("makes a pool with a template's counts as targets and no maps", async () => {
    const { owner } = await createCast();
    const response = await create(
      poolRequest("POST", "/api/pools", owner.cookie, { name: "Cup", template: "qualifiers" }),
    );
    expect(response.status).toBe(201);
    const { id } = (await response.json()) as { id: string };
    const stored = await findBuiltPool(id);
    expect(stored?.slots).toEqual([]);
    expect(stored?.targets).toEqual({
      NM: { count: 5 },
      HD: { count: 2 },
      HR: { count: 2 },
      DT: { count: 3 },
      FM: { count: 2 },
    });
  });

  it("copies a built pool's targets", async () => {
    const cast = await createCast();
    await insertPool(cast, { _id: ID, targets: { TB: { count: 1 } } });
    const response = await create(
      poolRequest("POST", "/api/pools", cast.owner.cookie, { startedFrom: ID }),
    );
    const { id } = (await response.json()) as { id: string };
    expect((await findBuiltPool(id))?.targets).toEqual({ TB: { count: 1 } });
  });
});

describe("setNote", () => {
  it("stores a note on a map, keeps it through a move, and drops it with the map", async () => {
    const cast = await createCast();
    await insertPool(cast, { _id: ID, slots: [{ mod: "NM", index: 1, beatmapId: 5 }] });
    const set = await send(cast, 1, [{ type: "setNote", beatmapId: 5, note: " jump aim " }]);
    expect(((await set.json()) as { pool: { slotNotes: unknown } }).pool.slotNotes).toEqual({
      5: "jump aim",
    });
    await send(cast, 2, [{ type: "moveMap", slot: { bucket: "NM", index: 1 }, bucket: "HD" }]);
    expect((await findBuiltPool(ID))?.slotNotes).toEqual({ 5: "jump aim" });
    await send(cast, 3, [{ type: "removeMap", slot: { bucket: "HD", index: 1 } }]);
    const row = await (await builtPoolsCollection()).findOne({ _id: ID });
    expect(row && "slotNotes" in row).toBe(false);
  });

  it("shows a stored note a newer filter refuses only to editors, and never copies it", async () => {
    const cast = await createCast();
    const slots = [
      { mod: "NM", index: 1, beatmapId: 5 },
      { mod: "NM", index: 2, beatmapId: 6 },
    ];
    await insertPool(cast, { _id: ID, visibility: "public", slots });
    // Written before the filter knew the word.
    await (await builtPoolsCollection()).updateOne(
      { _id: ID },
      { $set: { slotNotes: { 5: "retard map", 6: "jump aim" } } },
    );
    const notesFor = async (who: keyof Cast | null) => {
      const request = poolRequest("GET", `/api/pools/${ID}`, who ? cast[who].cookie : null);
      const body = (await (await getPool(request, params({ id: ID }))).json()) as {
        pool: { slotNotes: unknown };
      };
      return body.pool.slotNotes;
    };
    expect(await notesFor("owner")).toEqual({ 5: "retard map", 6: "jump aim" });
    expect(await notesFor("other")).toEqual({ 6: "jump aim" });
    expect(await notesFor("admin")).toEqual({ 6: "jump aim" });
    const response = await create(
      poolRequest("POST", "/api/pools", cast.other.cookie, { startedFrom: ID }),
    );
    expect(response.status).toBe(201);
    const { id } = (await response.json()) as { id: string };
    expect((await findBuiltPool(id))?.slotNotes).toEqual({ 6: "jump aim" });
  });

  it("refuses a note the content filter blocks", async () => {
    const cast = await createCast();
    await insertPool(cast, { _id: ID, slots: [{ mod: "NM", index: 1, beatmapId: 5 }] });
    const response = await send(cast, 1, [{ type: "setNote", beatmapId: 5, note: "retard" }]);
    expect(response.status).toBe(400);
    expect(((await response.json()) as { error: { code: string } }).error.code).toBe(
      "content_filter",
    );
  });
});
