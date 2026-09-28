/**
 * @file tests/integration/services/built-pack-sync-races.test.ts
 * @desc Two syncs of one pool at once, with packs' answers held back by hand: a PUT whose claim
 *       a newer sync took over writes nothing of its own and leaves the pool pending, so the
 *       current state is sent again; a forced sync waits for a claim younger than the PUT
 *       timeout, and leaves the pool pending when it's still busy after that; a change during
 *       the PUT leaves the pool pending even when the change itself didn't say so.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { setupMsw } from "@haruhimemoe/next-kit/testing";
import { HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PACKS_TIMEOUT_MS } from "@/lib/packs-client";
import { builtPoolsCollection } from "@/models/BuiltPool";
import { syncBuiltPack } from "@/services/built-pack-sync";
import { findBuiltPool } from "@/services/built-pool-read";
import { markPackPending } from "@/services/built-pools";
import { EMPTY_BUILT_PACK } from "@/utils/built-pack";
import type { PackInput } from "@/utils/pack-input";
import { setupTestDb } from "../../helpers/db";
import { packsPutHandler, slugFor, TEST_SERVICE } from "../../helpers/packs-server";
import { createCast, insertPool } from "../../helpers/pool-requests";

setupTestDb();
const server = setupMsw();
const ID = "b-a0000001";
const T0 = new Date("2026-09-27T12:00:00.000Z");
const at = (ms: number) => new Date(T0.getTime() + ms);
const SLOTS = [{ mod: "NM", index: 1, beatmapId: 5 }];

beforeEach(() => {
  vi.stubEnv("POOLS_SERVICE_TOKEN", TEST_SERVICE.token);
  vi.stubEnv("PACKS_URL", TEST_SERVICE.url);
});
afterEach(() => {
  vi.stubEnv("POOLS_SERVICE_TOKEN", "");
  vi.stubEnv("PACKS_URL", "");
});

/** packs holding the first PUT until `release`, and answering the rest at once. */
const heldPacks = () => {
  const sent: PackInput["visibility"][] = [];
  const arrived = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  server.use(
    packsPutHandler(async (id, body: PackInput) => {
      sent.push(body.visibility);
      if (sent.length === 1) {
        arrived.resolve();
        await release.promise;
      }
      const listed = body.visibility === "public";
      return HttpResponse.json({ slug: slugFor(id), state: "updated", listed });
    }),
  );
  return { sent, arrived: arrived.promise, release: () => release.resolve() };
};

const publicPool = async () =>
  insertPool(await createCast(), {
    _id: ID,
    visibility: "public",
    slots: SLOTS,
    pack: { ...EMPTY_BUILT_PACK, state: "pending" },
  });

/** A change the way a route makes one: a new version, the pack pending. */
const change = async (set: Record<string, unknown>) => {
  await (await builtPoolsCollection()).updateOne({ _id: ID }, { $set: set, $inc: { version: 1 } });
  await markPackPending(ID);
};

describe("syncBuiltPack: a PUT that lands after a newer one", () => {
  it("writes nothing of its own and leaves the pool pending for the current state", async () => {
    const packs = heldPacks();
    await publicPool();
    const first = syncBuiltPack(ID, { now: () => at(0) });
    await packs.arrived;
    await change({ visibility: "unlisted" });
    // A claim older than the PUT timeout is free to take.
    expect(await syncBuiltPack(ID, { force: true, now: () => at(PACKS_TIMEOUT_MS) })).toBe(true);
    packs.release();
    expect(await first).toBe(true);
    expect(packs.sent).toEqual(["public", "unlisted"]);
    expect((await findBuiltPool(ID))?.pack).toMatchObject({
      state: "pending",
      listed: false,
      syncedAt: at(PACKS_TIMEOUT_MS),
      lastAttemptAt: at(PACKS_TIMEOUT_MS),
    });
    expect(await syncBuiltPack(ID, { now: () => at(60_000) })).toBe(true);
    expect(packs.sent).toEqual(["public", "unlisted", "unlisted"]);
    expect((await findBuiltPool(ID))?.pack).toMatchObject({ state: "synced", listed: false });
  });
});

describe("syncBuiltPack: a forced sync while another is out", () => {
  it("waits for a claim younger than the PUT timeout, then sends the current state", async () => {
    const packs = heldPacks();
    await publicPool();
    const first = syncBuiltPack(ID, { now: () => at(0) });
    await packs.arrived;
    await change({ hidden: true });
    let clock = at(1_000);
    const waited: number[] = [];
    const waiting = Promise.withResolvers<void>();
    const done = Promise.withResolvers<void>();
    const forced = syncBuiltPack(ID, {
      force: true,
      now: () => clock,
      wait: async (ms) => {
        waited.push(ms);
        waiting.resolve();
        await done.promise;
      },
    });
    await waiting.promise;
    expect(waited).toEqual([PACKS_TIMEOUT_MS - 1_000]);
    expect(packs.sent).toEqual(["public"]);
    packs.release();
    await first;
    expect((await findBuiltPool(ID))?.pack).toMatchObject({ state: "pending", slug: slugFor(ID) });
    clock = at(PACKS_TIMEOUT_MS);
    done.resolve();
    expect(await forced).toBe(true);
    expect(packs.sent).toEqual(["public", "unlisted"]);
    expect((await findBuiltPool(ID))?.pack).toMatchObject({ state: "synced", listed: false });
  });

  it("leaves the pool pending when the claim is still busy after the wait", async () => {
    const packs = heldPacks();
    await publicPool();
    await (await builtPoolsCollection()).updateOne(
      { _id: ID },
      { $set: { "pack.state": "synced", "pack.lastAttemptAt": at(0) } },
    );
    const forced = { force: true, now: () => at(1_000), wait: async () => {} };
    expect(await syncBuiltPack(ID, forced)).toBe(false);
    expect(packs.sent).toEqual([]);
    expect((await findBuiltPool(ID))?.pack).toMatchObject({
      state: "pending",
      lastAttemptAt: at(0),
    });
  });
});

describe("syncBuiltPack: a change during the PUT that didn't mark the pack", () => {
  it("still leaves the pool pending, with the pack's slug", async () => {
    const packs = heldPacks();
    await publicPool();
    const pools = await builtPoolsCollection();
    await pools.updateOne({ _id: ID }, { $set: { "pack.state": "synced" } });
    const first = syncBuiltPack(ID, { force: true, now: () => at(0) });
    await packs.arrived;
    await pools.updateOne({ _id: ID }, { $inc: { version: 1 } });
    packs.release();
    await first;
    expect((await findBuiltPool(ID))?.pack).toMatchObject({ state: "pending", slug: slugFor(ID) });
  });
});
