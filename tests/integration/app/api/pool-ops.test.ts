/**
 * @file tests/integration/app/api/pool-ops.test.ts
 * @desc POST /api/pools/<id>/ops end to end: every op type through the route, each call a new
 *       version; a stale base version is a 409 carrying the pool as it is now (and two editors
 *       racing on one version: one wins, one gets the 409; an editor removed mid-call gets a 404,
 *       not the pool; a write only sets content, so a change to editors, pack or hidden made
 *       without a new version survives it); a map already in the pool is 400
 *       duplicate; the limits (20 ops a call, 64 maps, 8 custom buckets, the 32 KB body, 120 ops
 *       a minute per user); a failing op changes nothing; text goes through the content filter.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Mon Sep 28, 2026
 */

import { Collection } from "mongodb";
import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/pools/[id]/ops/route";
import { builtPoolsCollection } from "@/models/BuiltPool";
import { findBuiltPool } from "@/services/built-pool-read";
import { setupTestDb } from "../../../helpers/db";
import {
  type Cast,
  createCast,
  insertPool,
  params,
  poolRequest,
} from "../../../helpers/pool-requests";

setupTestDb();
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/** Runs `meanwhile` just before the ops call's write, as a concurrent request would. */
const beforeTheWrite = (meanwhile: () => Promise<unknown>) => {
  const write = Collection.prototype.findOneAndUpdate;
  vi.spyOn(Collection.prototype, "findOneAndUpdate").mockImplementationOnce(async function (
    this: Collection,
    ...args: Parameters<Collection["findOneAndUpdate"]>
  ) {
    await meanwhile();
    return (write as (...a: unknown[]) => unknown).apply(this, args);
  } as never);
};

const ID = "b-a0000001";

const send = (cast: Cast, body: unknown, who: keyof Cast = "owner") =>
  POST(poolRequest("POST", `/api/pools/${ID}/ops`, cast[who].cookie, body), params({ id: ID }));

const op = (beatmapId: number, baseVersion = 1) => ({
  baseVersion,
  ops: [{ type: "addMap", beatmapId, bucket: "NM" }],
});

const errorOf = async (response: Response) =>
  ((await response.json()) as { error: { code: string; op?: number } }).error;

describe("POST /api/pools/<id>/ops", () => {
  it("applies every op in order, one version per call", async () => {
    const cast = await createCast();
    await insertPool(cast, { _id: ID });
    const response = await send(cast, {
      baseVersion: 1,
      ops: [
        { type: "setDetails", name: "Finals", notes: "Line one\nLine two" },
        { type: "replaceMaps", text: "NM1 10\nNM2 11\nHD1 12" },
        { type: "addMap", beatmapId: 13, bucket: "NM", index: 1 },
        { type: "addBucket", code: "EZ", mods: { kind: "forced", set: ["EZ"] } },
        { type: "moveMap", slot: { bucket: "HD", index: 1 }, bucket: "EZ" },
        { type: "setSlotMods", bucket: "EZ", mods: { kind: "free" } },
        { type: "removeMap", slot: { bucket: "NM", index: 3 } },
        { type: "addBucket", code: "Spare" },
        { type: "removeBucket", code: "Spare" },
      ],
    });
    expect(response.status).toBe(200);
    const { pool } = (await response.json()) as { pool: Record<string, unknown> };
    expect(pool).toMatchObject({ version: 2, name: "Finals", notes: "Line one\nLine two" });
    const stored = await findBuiltPool(ID);
    expect(stored?.slots).toEqual([
      { mod: "NM", index: 1, beatmapId: 13 },
      { mod: "NM", index: 2, beatmapId: 10 },
      { mod: "EZ", index: 1, beatmapId: 12 },
    ]);
    expect(stored?.buckets?.find((b) => b.code === "EZ")).toEqual({
      code: "EZ",
      color: 0,
      mods: { kind: "free" },
    });
    const again = await send(cast, { baseVersion: 2, ops: [{ type: "removeBucket", code: "EZ" }] });
    expect(await errorOf(again)).toMatchObject({ code: "bucket_not_empty", op: 0 });
  });
});

describe("versions", () => {
  it("answers a stale version with 409 and the pool as it is now", async () => {
    const cast = await createCast();
    await insertPool(cast, { _id: ID, version: 4 });
    const response = await send(cast, {
      baseVersion: 3,
      ops: [{ type: "addMap", beatmapId: 5, bucket: "NM" }],
    });
    expect(response.status).toBe(409);
    const body = (await response.json()) as { error: { code: string }; pool: { version: number } };
    expect(body.error.code).toBe("conflict");
    expect(body.pool.version).toBe(4);
    expect((await findBuiltPool(ID))?.slots).toEqual([]);
  });

  it("lets one of two editors racing on a version win; the other gets the 409", async () => {
    const cast = await createCast();
    await insertPool(cast, { _id: ID });
    const statuses = (await Promise.all([send(cast, op(1)), send(cast, op(2), "editor")])).map(
      (response) => response.status,
    );
    expect(statuses.sort()).toEqual([200, 409]);
    const stored = await findBuiltPool(ID);
    expect(stored?.version).toBe(2);
    expect(stored?.slots).toHaveLength(1);
  });
});

describe("concurrent changes", () => {
  it("answers 404, not the pool, to an editor removed while their call ran", async () => {
    const cast = await createCast();
    await insertPool(cast, { _id: ID });
    beforeTheWrite(async () =>
      (await builtPoolsCollection()).updateOne(
        { _id: ID },
        { $set: { editors: [] }, $inc: { version: 1 } },
      ),
    );
    const response = await send(cast, op(5), "editor");
    expect(response.status).toBe(404);
    expect(await response.json()).not.toHaveProperty("pool");
  });

  it("sets only content, keeping editors, pack and hidden changed without a new version", async () => {
    const cast = await createCast();
    await insertPool(cast, { _id: ID });
    beforeTheWrite(async () =>
      (await builtPoolsCollection()).updateOne(
        { _id: ID },
        { $set: { hidden: true, "editors.0.userId": "linked-later" } },
      ),
    );
    expect((await send(cast, op(5))).status).toBe(200);
    const stored = await findBuiltPool(ID);
    expect(stored).toMatchObject({ hidden: true, version: 2, slots: [{ beatmapId: 5 }] });
    expect(stored?.editors[0]?.userId).toBe("linked-later");
    expect(stored).not.toHaveProperty("buckets");
  });
});

describe("refusals", () => {
  it("refuses a map already in the pool with 400 duplicate, changing nothing", async () => {
    const cast = await createCast();
    await insertPool(cast, { _id: ID, slots: [{ mod: "HD", index: 1, beatmapId: 7 }] });
    const response = await send(cast, {
      baseVersion: 1,
      ops: [
        { type: "setDetails", name: "Changed" },
        { type: "addMap", beatmapId: 7, bucket: "NM" },
      ],
    });
    expect(response.status).toBe(400);
    expect(await errorOf(response)).toMatchObject({ code: "duplicate", op: 1 });
    expect(await findBuiltPool(ID)).toMatchObject({ name: "Spring Cup Finals", version: 1 });
  });

  it("holds the limits: 20 ops a call, 64 maps, 8 custom buckets", async () => {
    const cast = await createCast();
    await insertPool(cast, { _id: ID });
    const add = (beatmapId: number) => ({ type: "addMap", beatmapId, bucket: null });
    const tooMany = await send(cast, {
      baseVersion: 1,
      ops: Array.from({ length: 21 }, (_, i) => add(i + 1)),
    });
    expect(tooMany.status).toBe(400);
    const ids = Array.from({ length: 65 }, (_, i) => String(i + 1)).join("\n");
    const maps = await send(cast, { baseVersion: 1, ops: [{ type: "replaceMaps", text: ids }] });
    expect(await errorOf(maps)).toMatchObject({ code: "too_many_maps" });
    const codes = ["A", "B", "C", "D", "E", "F", "G", "H", "I"];
    const buckets = await send(cast, {
      baseVersion: 1,
      ops: codes.map((code) => ({ type: "addBucket", code })),
    });
    expect(await errorOf(buckets)).toMatchObject({ code: "too_many_buckets", op: 8 });
  });

  it("refuses text the content filter blocks, a body over 32 KB, and a loose body", async () => {
    const cast = await createCast();
    await insertPool(cast, { _id: ID });
    const filtered = await send(cast, {
      baseVersion: 1,
      ops: [{ type: "setDetails", notes: "sieg heil" }],
    });
    expect(filtered.status).toBe(400);
    expect(await errorOf(filtered)).toMatchObject({ code: "content_filter" });
    const code = await send(cast, { baseVersion: 1, ops: [{ type: "addBucket", code: "1488" }] });
    expect(await errorOf(code)).toMatchObject({ code: "content_filter" });
    const pasted = await send(cast, {
      baseVersion: 1,
      ops: [{ type: "replaceMaps", text: "KIKE1 5\nNM1 2" }],
    });
    expect(await errorOf(pasted)).toMatchObject({ code: "content_filter", op: 0 });
    const big = await send(cast, {
      baseVersion: 1,
      ops: [{ type: "replaceMaps", text: "1" }],
      pad: "x".repeat(33_000),
    });
    expect(big.status).toBe(413);
    const loose = await send(cast, {
      baseVersion: 1,
      ops: [{ type: "addBucket", code: "EZ" }],
      x: 1,
    });
    expect(loose.status).toBe(400);
  });

  it("allows 120 ops a minute per user, each op counted", async () => {
    // Early in a fixed window, so the minute can't roll over mid-test.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(`${new Date().toISOString().slice(0, 16)}:01.000Z`));
    const cast = await createCast();
    await insertPool(cast, { _id: ID });
    const twenty = Array.from({ length: 20 }, () => ({ type: "setDetails", round: "Finals" }));
    for (let version = 1; version <= 6; version++) {
      expect((await send(cast, { baseVersion: version, ops: twenty })).status).toBe(200);
    }
    const over = await send(cast, { baseVersion: 7, ops: [{ type: "setDetails", round: "x" }] });
    expect(over.status).toBe(429);
    expect(over.headers.get("retry-after")).toMatch(/^\d+$/);
    expect((await send(cast, { baseVersion: 7, ops: twenty }, "editor")).status).toBe(200);
  });
});
