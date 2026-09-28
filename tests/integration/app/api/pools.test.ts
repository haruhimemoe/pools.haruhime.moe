/**
 * @file tests/integration/app/api/pools.test.ts
 * @desc POST /api/pools: a visitor gets 401 and another site 403; a signed-in user makes a
 *       private, empty pool with a fresh "b-" id (claimed for good, so it's never handed out
 *       again, and a clash just draws another); text goes through the content filter; starting
 *       from a past pool (not a hidden one) or a built pool the caller can see copies its maps;
 *       at most 50 pools an owner and 10 new pools an hour.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/pools/route";
import { builtPoolIdsCollection, builtPoolsCollection } from "@/models/BuiltPool";
import { poolsCollection } from "@/models/Pool";
import { claimBuiltPoolId } from "@/services/built-pool-create";
import { findBuiltPool } from "@/services/built-pools";
import { makeBuiltPool } from "../../../helpers/built-pools";
import { setupTestDb } from "../../../helpers/db";
import { createCast, insertPool, poolRequest } from "../../../helpers/pool-requests";
import { makePool } from "../../../helpers/records";

setupTestDb();
afterEach(() => {
  vi.useRealTimers();
});

const create = (cookie: string | null, body: unknown, headers: Record<string, string> = {}) =>
  POST(poolRequest("POST", "/api/pools", cookie, body, headers));

type Created = { id: string; pool: Record<string, unknown> };

describe("POST /api/pools", () => {
  it("wants a signed-in caller from this site", async () => {
    expect((await create(null, { name: "Cup" })).status).toBe(401);
    const { owner } = await createCast();
    const crossSite = await create(owner.cookie, { name: "Cup" }, { origin: "https://evil.test" });
    expect(crossSite.status).toBe(403);
  });

  it("makes a private, empty pool with a fresh id it never hands out again", async () => {
    const { owner } = await createCast();
    const response = await create(owner.cookie, { name: " Spring Cup ", round: "Finals" });
    expect(response.status).toBe(201);
    const { id, pool } = (await response.json()) as Created;
    expect(id).toMatch(/^b-[a-z][0-9a-z]{7}$/);
    expect(pool).toMatchObject({
      name: "Spring Cup",
      round: "Finals",
      visibility: "private",
      version: 1,
      slots: [],
      owner: { osuId: 10, username: "owner" },
      access: { isOwner: true, canManage: true },
    });
    expect(await findBuiltPool(id)).toMatchObject({ ownerId: owner.id, hidden: false });
    await (await builtPoolsCollection()).deleteOne({ _id: id });
    expect(await (await builtPoolIdsCollection()).countDocuments({ _id: id })).toBe(1);
  });

  it("draws another id when one is taken, and gives up after five", async () => {
    const zeros = () => new Uint8Array([0]);
    const now = new Date();
    expect(await claimBuiltPoolId(now, zeros)).toBe("b-a0000000");
    await expect(claimBuiltPoolId(now, zeros)).rejects.toThrow("Couldn't find a free");
    let byte = 0;
    const counting = () => new Uint8Array([byte++ < 8 ? 0 : 1]);
    expect(await claimBuiltPoolId(now, counting)).toBe("b-b1111111");
  });

  it("refuses text the content filter blocks, and a loose body", async () => {
    const { owner } = await createCast();
    expect((await create(owner.cookie, { name: "retard cup" })).status).toBe(400);
    expect((await create(owner.cookie, { name: "Cup", visibility: "public" })).status).toBe(400);
  });
});

describe("starting from a pool", () => {
  it("copies a past pool's maps, buckets and details", async () => {
    const { owner } = await createCast();
    const slots = [
      { mod: "NM", index: 1, beatmapId: 1001 },
      { mod: "HD", index: 1, beatmapId: 1002 },
      { mod: "TB", index: 1, beatmapId: 1001 },
    ];
    await (await poolsCollection()).insertOne(makePool({ _id: "otdb-9", slots }));
    const response = await create(owner.cookie, { startedFrom: "otdb-9" });
    expect(response.status).toBe(201);
    const { pool } = (await response.json()) as Created;
    expect(pool).toMatchObject({
      name: "Spring Cup 2020 Finals",
      tournament: "Spring Cup",
      round: "Finals",
      year: 2020,
      startedFrom: "otdb-9",
      visibility: "private",
      // Each map once: the first slot it was in.
      slots: slots.slice(0, 2),
    });
    const named = await create(owner.cookie, { startedFrom: "otdb-9", name: "Mine" });
    expect(((await named.json()) as Created).pool).toMatchObject({ name: "Mine" });
  });

  it("won't copy a hidden past pool, or a built pool the caller can't see", async () => {
    const cast = await createCast();
    await (await poolsCollection()).insertOne(makePool({ _id: "otdb-9", hidden: true }));
    expect((await create(cast.owner.cookie, { startedFrom: "otdb-9" })).status).toBe(404);
    await insertPool(cast, { _id: "b-a0000001", slots: [{ mod: "NM", index: 1, beatmapId: 5 }] });
    expect((await create(cast.other.cookie, { startedFrom: "b-a0000001" })).status).toBe(404);
    const copied = await create(cast.editor.cookie, { startedFrom: "b-a0000001" });
    expect(((await copied.json()) as Created).pool).toMatchObject({
      slots: [{ mod: "NM", index: 1, beatmapId: 5 }],
      owner: { username: "editor" },
    });
  });
});

describe("limits", () => {
  it("lets an owner have 50 pools", async () => {
    const { owner } = await createCast();
    const fifty = Array.from({ length: 50 }, (_, i) =>
      makeBuiltPool({ _id: `b-z${String(i).padStart(7, "0")}`, ownerId: owner.id }),
    );
    await (await builtPoolsCollection()).insertMany(fifty);
    const response = await create(owner.cookie, { name: "One more" });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "too_many_pools" } });
  });

  it("allows 10 new pools an hour per user", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(`${new Date().toISOString().slice(0, 13)}:00:01.000Z`));
    const { owner, other } = await createCast();
    for (let i = 0; i < 10; i++) {
      expect((await create(owner.cookie, { name: `Cup ${i}` })).status).toBe(201);
    }
    expect((await create(owner.cookie, { name: "Cup 11" })).status).toBe(429);
    expect((await create(other.cookie, { name: "Theirs" })).status).toBe(201);
  });
});
