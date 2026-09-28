/**
 * @file tests/integration/services/built-pack-sync.test.ts
 * @desc A built pool's pack sync against a stand-in packs: a pending unlisted or public pool is
 *       sent (name, description crediting the owner and editors, visibility, slots) and comes
 *       back synced whether packs created, updated or left it; a 410 marks it failed and gone
 *       for good; a network failure marks it failed and it's tried again later; one sync per
 *       30 s per pool; a pool that went private or was deleted while its PUT was out loses the
 *       pack it just got; an empty pool is never sent; every run retries due pack removals.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

import { HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { builtPoolsCollection } from "@/models/BuiltPool";
import { syncBuiltPack } from "@/services/built-pack-sync";
import { findBuiltPool, markPackPending } from "@/services/built-pools";
import { packCleanupCollection } from "@/services/pack-cleanup";
import { EMPTY_BUILT_PACK, PACK_GONE } from "@/utils/built-pack";
import { setupTestDb } from "../../helpers/db";
import { setupMsw } from "../../helpers/msw";
import {
  createdAnswer,
  type DeleteCall,
  type PutCall,
  packsDeleteHandler,
  packsPutHandler,
  slugFor,
  TEST_SERVICE,
} from "../../helpers/packs-server";
import { type Cast, createCast, insertPool } from "../../helpers/pool-requests";

setupTestDb();
const server = setupMsw();
let cast: Cast;
const ID = "b-a0000001";
const T0 = new Date("2026-09-27T12:00:00.000Z");
const at = (ms: number) => () => new Date(T0.getTime() + ms);
const SLOTS = [
  { mod: "NM", index: 1, beatmapId: 5 },
  { mod: "HD", index: 1, beatmapId: 6 },
];
const PENDING = { ...EMPTY_BUILT_PACK, state: "pending" as const };

beforeEach(async () => {
  vi.stubEnv("POOLS_SERVICE_TOKEN", TEST_SERVICE.token);
  vi.stubEnv("PACKS_URL", TEST_SERVICE.url);
  cast = await createCast();
});
afterEach(() => {
  vi.stubEnv("POOLS_SERVICE_TOKEN", "");
  vi.stubEnv("PACKS_URL", "");
});

const answered = (state: "updated" | "unchanged") => (id: string) =>
  HttpResponse.json({ slug: slugFor(id), state, listed: true });

const pool = async (overrides = {}) =>
  insertPool(cast, { _id: ID, visibility: "public", slots: SLOTS, pack: PENDING, ...overrides });

describe("syncBuiltPack", () => {
  it("sends a pending public pool and marks it synced", async () => {
    const calls: PutCall[] = [];
    server.use(packsPutHandler(createdAnswer, calls));
    await pool();
    expect(await syncBuiltPack(ID, { now: at(0) })).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.id).toBe(ID);
    expect(calls[0]?.body).toEqual({
      name: "Spring Cup Finals",
      description: `Built on pools.haruhime.moe by owner and editor: https://pools.haruhime.moe/pools/${ID}`,
      visibility: "public",
      slots: SLOTS,
    });
    expect((await findBuiltPool(ID))?.pack).toEqual({
      state: "synced",
      slug: slugFor(ID),
      syncedAt: T0,
      error: null,
      lastAttemptAt: T0,
      listed: true,
      gone: false,
    });
  });

  it.each(["updated", "unchanged"] as const)("is synced when packs says %s", async (state) => {
    server.use(packsPutHandler(answered(state)));
    await pool({ visibility: "unlisted" });
    await syncBuiltPack(ID, { now: at(0) });
    expect((await findBuiltPool(ID))?.pack).toMatchObject({ state: "synced", error: null });
  });

  it("stops syncing a pool whose pack packs' moderators removed (410)", async () => {
    const calls: PutCall[] = [];
    server.use(packsPutHandler(() => new HttpResponse(null, { status: 410 }), calls));
    await pool();
    await syncBuiltPack(ID, { now: at(0) });
    expect((await findBuiltPool(ID))?.pack).toMatchObject({
      state: "failed",
      error: PACK_GONE,
      gone: true,
    });
    expect(await markPackPending(ID)).toBeNull();
    expect(await syncBuiltPack(ID, { now: at(60_000) })).toBe(false);
    expect(await syncBuiltPack(ID, { now: at(60_000), force: true })).toBe(false);
    expect(calls).toHaveLength(1);
  });

  it("marks a network failure failed with the reason, and tries again after 30 s", async () => {
    server.use(packsPutHandler(() => HttpResponse.error()));
    await pool();
    await syncBuiltPack(ID, { now: at(0) });
    const failed = await findBuiltPool(ID);
    expect(failed?.pack.state).toBe("failed");
    expect(failed?.pack.error).toMatch(/^Couldn't reach packs/);
    server.use(packsPutHandler(createdAnswer));
    expect(await syncBuiltPack(ID, { now: at(29_999) })).toBe(false);
    expect(await syncBuiltPack(ID, { now: at(30_000) })).toBe(true);
    expect((await findBuiltPool(ID))?.pack.state).toBe("synced");
  });

  it("syncs a pool at most once every 30 s; a later change waits for the next sync", async () => {
    const calls: PutCall[] = [];
    server.use(packsPutHandler(createdAnswer, calls));
    await pool();
    await syncBuiltPack(ID, { now: at(0) });
    await markPackPending(ID);
    expect(await syncBuiltPack(ID, { now: at(10_000) })).toBe(false);
    expect((await findBuiltPool(ID))?.pack.state).toBe("pending");
    expect(await syncBuiltPack(ID, { now: at(31_000) })).toBe(true);
    expect(calls).toHaveLength(2);
    // "Update pack now" doesn't wait.
    await markPackPending(ID);
    expect(await syncBuiltPack(ID, { now: at(32_000), force: true })).toBe(true);
    expect(calls).toHaveLength(3);
  });
});

describe("syncBuiltPack: what never goes to packs", () => {
  it("never sends a private pool, or an empty one without a pack", async () => {
    const calls: PutCall[] = [];
    server.use(packsPutHandler(createdAnswer, calls));
    await pool({ visibility: "private" });
    expect(await syncBuiltPack(ID, { now: at(0), force: true })).toBe(false);
    await insertPool(cast, { _id: "b-a0000002", visibility: "public", pack: PENDING });
    await syncBuiltPack("b-a0000002", { now: at(0) });
    expect(calls).toEqual([]);
    expect((await findBuiltPool("b-a0000002"))?.pack.state).toBe("none");
    expect(await markPackPending("b-a0000002")).toBeNull();
  });

  it("removes the pack of a pool that was emptied", async () => {
    const deletes: DeleteCall[] = [];
    server.use(packsDeleteHandler(undefined, deletes));
    await pool({ slots: [], pack: { ...PENDING, slug: "Abc123" } });
    await syncBuiltPack(ID, { now: at(0) });
    expect(deletes.map((call) => call.id)).toEqual([ID]);
    expect((await findBuiltPool(ID))?.pack).toMatchObject({ state: "none", slug: null });
  });

  it("removes the pack it just made when the pool went private during the PUT", async () => {
    const deletes: DeleteCall[] = [];
    server.use(
      packsPutHandler(async (id) => {
        await (await builtPoolsCollection()).updateOne(
          { _id: id },
          { $set: { visibility: "private", pack: EMPTY_BUILT_PACK }, $inc: { version: 1 } },
        );
        return createdAnswer(id);
      }),
      packsDeleteHandler(undefined, deletes),
    );
    await pool();
    await syncBuiltPack(ID, { now: at(0) });
    expect(deletes.map((call) => call.id)).toEqual([ID]);
    expect((await findBuiltPool(ID))?.pack.state).toBe("none");
  });

  it("leaves a pool pending while packs isn't set up here", async () => {
    vi.stubEnv("POOLS_SERVICE_TOKEN", "");
    await pool();
    expect(await syncBuiltPack(ID, { now: at(0) })).toBe(false);
    expect((await findBuiltPool(ID))?.pack.state).toBe("pending");
  });

  it("retries due pack removals on each run", async () => {
    const deletes: DeleteCall[] = [];
    server.use(packsPutHandler(createdAnswer), packsDeleteHandler(undefined, deletes));
    await (await packCleanupCollection()).insertOne({
      _id: "b-a0000009",
      ref: "b-a0000009",
      reason: "packs answered 503.",
      attempts: 1,
      nextAt: T0,
      queuedAt: T0,
    });
    await pool();
    await syncBuiltPack(ID, { now: at(0) });
    expect(deletes.map((call) => call.id)).toEqual(["b-a0000009"]);
    expect(await (await packCleanupCollection()).countDocuments()).toBe(0);
  });
});

describe("syncBuiltPack: a change during the PUT", () => {
  it("keeps the pool pending, with the pack's slug, for the next sync", async () => {
    server.use(
      packsPutHandler(async (id) => {
        await (await builtPoolsCollection()).updateOne(
          { _id: id },
          { $set: { name: "Renamed" }, $inc: { version: 1 } },
        );
        await markPackPending(id);
        return createdAnswer(id);
      }),
    );
    await pool();
    await syncBuiltPack(ID, { now: at(0) });
    expect((await findBuiltPool(ID))?.pack).toMatchObject({
      state: "pending",
      slug: slugFor(ID),
      lastAttemptAt: T0,
    });
  });
});
