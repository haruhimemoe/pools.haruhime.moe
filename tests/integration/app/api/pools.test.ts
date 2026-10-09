/**
 * @file tests/integration/app/api/pools.test.ts
 * @desc POST /api/pools: a visitor gets 401 and another site 403; a signed-in user makes a
 *       private, empty pool with a fresh "b-" id (claimed for good, so it's never handed out
 *       again, and a clash just draws another); text goes through the content filter; starting
 *       from a past pool (not a hidden one) or a built pool the caller can see copies its maps;
 *       at most 50 pools an owner (parallel creates can't go past it) and 10 new pools an hour.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Mon Sep 28, 2026
 */

import { encodePackKey } from "@haruhimemoe/pool";
import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/pools/route";
import { builtPoolIdsCollection, builtPoolsCollection } from "@/models/BuiltPool";
import { poolsCollection } from "@/models/Pool";
import { claimBuiltPoolId, startPreview } from "@/services/built-pool-create";
import { findBuiltPool } from "@/services/built-pool-read";
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
    expect(await findBuiltPool(id)).toMatchObject({ head: { seq: 0 } });
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
    // Details the person cleared stay cleared: what they sent wins over the pool's.
    const cleared = {
      startedFrom: "otdb-9",
      name: "Practice",
      tournament: "",
      round: "",
      year: null,
    };
    const generic = await create(owner.cookie, cleared);
    expect(((await generic.json()) as Created).pool).toMatchObject({
      name: "Practice",
      tournament: "",
      round: "",
      year: null,
    });
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

describe("starting from a draft key", () => {
  const slots = [
    { mod: "NM", index: 1, beatmapId: 2001 },
    { mod: "HD", index: 1, beatmapId: 2002 },
  ];

  it("makes a private pool holding the key's maps", async () => {
    const { owner } = await createCast();
    const draftKey = encodePackKey({ name: "peppy's draft pool", slots });
    const response = await create(owner.cookie, { draftKey });
    expect(response.status).toBe(201);
    const { pool } = (await response.json()) as Created;
    expect(pool).toMatchObject({ name: "peppy's draft pool", visibility: "private", slots });
    const named = await create(owner.cookie, { draftKey, name: "Mine" });
    expect(((await named.json()) as Created).pool).toMatchObject({ name: "Mine", slots });
  });

  it("refuses a key that doesn't read, a repeated map, or a key with a pool to copy", async () => {
    const { owner } = await createCast();
    expect((await create(owner.cookie, { draftKey: "pk1.nope" })).status).toBe(400);
    const twice = encodePackKey({
      name: "Twice",
      slots: [slots[0] as (typeof slots)[number], { mod: "HD", index: 1, beatmapId: 2001 }],
    });
    expect((await create(owner.cookie, { draftKey: twice })).status).toBe(400);
    const both = { draftKey: encodePackKey({ name: "x", slots }), startedFrom: "otdb-9" };
    expect((await create(owner.cookie, both)).status).toBe(400);
  });
});

describe("startPreview (/new?from=<id>)", () => {
  it("previews a past pool or a built one the caller sees, and nothing else", async () => {
    const cast = await createCast();
    const slots = [
      { mod: "NM", index: 1, beatmapId: 1001 },
      { mod: "TB", index: 1, beatmapId: 1001 },
    ];
    await (await poolsCollection()).insertMany([
      makePool({ _id: "otdb-9", slots }),
      makePool({ _id: "otdb-10", hidden: true }),
    ]);
    await insertPool(cast, { _id: "b-a0000001", slots: slots.slice(0, 1) });
    const owner = { ...cast.owner, avatarUrl: null, isAdmin: false };
    expect(await startPreview("otdb-9", owner)).toEqual({
      id: "otdb-9",
      name: "Spring Cup 2020 Finals",
      tournament: "Spring Cup",
      round: "Finals",
      year: 2020,
      maps: 1,
    });
    expect(await startPreview("b-a0000001", owner)).toMatchObject({ maps: 1 });
    const other = { ...cast.other, avatarUrl: null, isAdmin: false };
    expect(await startPreview("b-a0000001", other)).toBeNull();
    expect(await startPreview("otdb-10", owner)).toBeNull();
    expect(await startPreview("Not an id!", owner)).toBeNull();
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

  it("never goes past 50 pools, even with creates racing each other", async () => {
    const { owner } = await createCast();
    const many = Array.from({ length: 45 }, (_, i) =>
      makeBuiltPool({ _id: `b-z${String(i).padStart(7, "0")}`, ownerId: owner.id }),
    );
    await (await builtPoolsCollection()).insertMany(many);
    const responses = await Promise.all(
      Array.from({ length: 9 }, (_, i) => create(owner.cookie, { name: `Race ${i}` })),
    );
    const statuses = responses.map((response) => response.status);
    expect(statuses.every((status) => status === 201 || status === 400)).toBe(true);
    const owned = await (await builtPoolsCollection()).countDocuments({ ownerId: owner.id });
    expect(owned).toBeLessThanOrEqual(50);
    expect(owned).toBe(45 + statuses.filter((status) => status === 201).length);
    // The burst is over: the next one fits while there's room.
    const next = await create(owner.cookie, { name: "After the race" });
    expect(next.status).toBe(owned < 50 ? 201 : 400);
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
