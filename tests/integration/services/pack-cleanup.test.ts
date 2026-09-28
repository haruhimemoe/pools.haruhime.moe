/**
 * @file tests/integration/services/pack-cleanup.test.ts
 * @desc Pack removals that never block anyone: a pool without a pack needs no call; packs saying
 *       yes removes it; packs down, refusing or not set up queues the removal in pack_cleanup
 *       (ref, reason, attempts, nextAt) instead. Retrying tries the due ones (or all of them),
 *       drops the ones packs removed, pushes back the ones still failing, drops without a call
 *       the ones whose pool wants its pack again (shared, with maps), marks pending a pool that
 *       wanted it again by the time packs removed it, and stops at a configuration answer or
 *       after two failures in a row (so a packs outage can't hold a request for long). Every
 *       sync run retries the due ones too.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Mon Sep 28, 2026
 */

import { setupMsw } from "@haruhimemoe/next-kit/testing";
import { HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { builtPoolsCollection } from "@/models/BuiltPool";
import { findBuiltPool } from "@/services/built-pool-read";
import {
  packCleanupCollection,
  removePackOrQueue,
  retryPackCleanup,
} from "@/services/pack-cleanup";
import { syncPools } from "@/services/sync";
import { makeBuiltPool } from "../../helpers/built-pools";
import { setupTestDb } from "../../helpers/db";
import { type DeleteCall, packsDeleteHandler, TEST_SERVICE } from "../../helpers/packs-server";
import { createCast, insertPool } from "../../helpers/pool-requests";

setupTestDb();
const server = setupMsw();
afterEach(() => {
  vi.stubEnv("POOLS_SERVICE_TOKEN", "");
  vi.stubEnv("PACKS_URL", "");
});

const NOW = new Date("2026-09-27T12:00:00.000Z");
const SYNCED = {
  state: "synced" as const,
  slug: "Abc123",
  syncedAt: NOW,
  error: null,
  lastAttemptAt: null,
  listed: true,
  gone: false,
  retry: true,
};
const withPacks = () => {
  vi.stubEnv("POOLS_SERVICE_TOKEN", TEST_SERVICE.token);
  vi.stubEnv("PACKS_URL", TEST_SERVICE.url);
};
const down = () => HttpResponse.json({ message: "Down." }, { status: 503 });

const queue = async (ref: string, nextAt: Date, attempts = 1) =>
  (await packCleanupCollection()).insertOne({
    _id: ref,
    ref,
    reason: "packs answered 503.",
    attempts,
    nextAt,
    queuedAt: NOW,
  });

describe("removePackOrQueue", () => {
  it("makes no call for a pool without a pack", async () => {
    expect(await removePackOrQueue(makeBuiltPool(), NOW)).toBe("none");
  });

  it("removes the pack when packs says so", async () => {
    withPacks();
    const calls: DeleteCall[] = [];
    server.use(packsDeleteHandler(undefined, calls));
    expect(await removePackOrQueue(makeBuiltPool({ pack: SYNCED }), NOW)).toBe("removed");
    expect(calls.map((call) => call.id)).toEqual(["b-a0000001"]);
    expect(await (await packCleanupCollection()).countDocuments()).toBe(0);
  });

  it("queues the removal when packs is down, and when it isn't set up here", async () => {
    withPacks();
    server.use(packsDeleteHandler(down));
    expect(await removePackOrQueue(makeBuiltPool({ pack: SYNCED }), NOW)).toBe("queued");
    const entries = await packCleanupCollection();
    expect(await entries.findOne({ _id: "b-a0000001" })).toEqual({
      _id: "b-a0000001",
      ref: "b-a0000001",
      reason: "packs answered 503: Down.",
      attempts: 1,
      nextAt: new Date(NOW.getTime() + 5 * 60_000),
      queuedAt: NOW,
    });
    vi.stubEnv("POOLS_SERVICE_TOKEN", "");
    const other = makeBuiltPool({ _id: "b-a0000002", pack: SYNCED });
    expect(await removePackOrQueue(other, NOW)).toBe("queued");
    expect((await entries.findOne({ _id: "b-a0000002" }))?.reason).toBe("packs isn't set up here.");
  });
});

describe("retryPackCleanup", () => {
  const later = new Date(NOW.getTime() + 60 * 60_000);

  it("tries the due removals, drops the done ones and pushes back the failing ones", async () => {
    await queue("b-a0000001", NOW);
    await queue("b-a0000002", NOW, 3);
    await queue("b-a0000003", later);
    const calls: DeleteCall[] = [];
    server.use(
      packsDeleteHandler(
        (id) => (id === "b-a0000001" ? new HttpResponse(null, { status: 204 }) : down()),
        calls,
      ),
    );
    const summary = await retryPackCleanup(TEST_SERVICE, { now: () => NOW });
    expect(summary).toEqual({
      due: 2,
      removed: 1,
      failed: 1,
      kept: 0,
      remaining: 2,
      configError: null,
    });
    expect(calls.map((call) => call.id).sort()).toEqual(["b-a0000001", "b-a0000002"]);
    const entries = await packCleanupCollection();
    expect(await entries.findOne({ _id: "b-a0000001" })).toBeNull();
    expect(await entries.findOne({ _id: "b-a0000002" })).toMatchObject({
      attempts: 4,
      nextAt: new Date(NOW.getTime() + 40 * 60_000),
    });
  });

  it("tries every one when asked, and keeps the pack of a pool that wants it again", async () => {
    const cast = await createCast();
    const slots = [{ mod: "NM", index: 1, beatmapId: 5 }];
    await insertPool(cast, { _id: "b-a0000001", visibility: "public", slots });
    await insertPool(cast, { _id: "b-a0000002", visibility: "private", slots });
    // Emptied: a pool with no maps has no pack.
    await insertPool(cast, { _id: "b-a0000003", visibility: "public" });
    for (const ref of ["b-a0000001", "b-a0000002", "b-a0000003"]) await queue(ref, later);
    const calls: DeleteCall[] = [];
    server.use(packsDeleteHandler(undefined, calls));
    const summary = await retryPackCleanup(TEST_SERVICE, { all: true, now: () => NOW });
    expect(summary).toMatchObject({ due: 3, removed: 2, kept: 1, remaining: 0 });
    expect(calls.map((call) => call.id)).toEqual(["b-a0000002", "b-a0000003"]);
  });

  it("marks the pack pending again when a sync made it during the DELETE", async () => {
    const cast = await createCast();
    await insertPool(cast, { _id: "b-a0000001", visibility: "private" });
    await queue("b-a0000001", NOW);
    server.use(
      packsDeleteHandler(async () => {
        // The owner made it unlisted with maps, and its sync made the pack, meanwhile.
        const slots = [{ mod: "NM", index: 1, beatmapId: 5 }];
        await (await builtPoolsCollection()).updateOne(
          { _id: "b-a0000001" },
          { $set: { visibility: "unlisted", slots, pack: { ...SYNCED, listed: false } } },
        );
        return new HttpResponse(null, { status: 204 });
      }),
    );
    expect(await retryPackCleanup(TEST_SERVICE, { now: () => NOW })).toMatchObject({ removed: 1 });
    expect((await findBuiltPool("b-a0000001"))?.pack.state).toBe("pending");
  });

  it("stops after two failures in a row: packs looks down", async () => {
    for (const ref of ["b-a0000001", "b-a0000002", "b-a0000003"]) await queue(ref, NOW);
    const calls: DeleteCall[] = [];
    server.use(packsDeleteHandler(down, calls));
    const summary = await retryPackCleanup(TEST_SERVICE, { now: () => NOW });
    expect(summary).toMatchObject({ due: 3, failed: 2, remaining: 3 });
    expect(calls).toHaveLength(2);
    expect((await (await packCleanupCollection()).findOne({ _id: "b-a0000003" }))?.attempts).toBe(
      1,
    );
  });

  it("stops at a configuration answer, changing nothing", async () => {
    await queue("b-a0000001", NOW);
    await queue("b-a0000002", NOW);
    server.use(packsDeleteHandler(() => HttpResponse.json({}, { status: 401 })));
    const summary = await retryPackCleanup(TEST_SERVICE, { now: () => NOW });
    expect(summary.configError).toMatch(/401/);
    expect(summary.remaining).toBe(2);
    expect(await (await packCleanupCollection()).countDocuments({ attempts: 1 })).toBe(2);
  });
});

describe("syncPools", () => {
  it("retries the due pack removals on every run", async () => {
    await queue("b-a0000001", new Date(Date.now() - 1000));
    const calls: DeleteCall[] = [];
    server.use(packsDeleteHandler(undefined, calls));
    await syncPools({ service: TEST_SERVICE, ids: [] });
    expect(calls.map((call) => call.id)).toEqual(["b-a0000001"]);
    expect(await (await packCleanupCollection()).countDocuments()).toBe(0);
  });
});
