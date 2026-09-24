/**
 * @file tests/integration/services/sync.test.ts
 * @desc Syncing packs against a stand-in packs: only due pools go (never gone, rejected held
 *       unless changed or asked for), answers are stored on each pool, hidden and superseded
 *       pools go unlisted, a limit leaves the rest counted, a 401 stops new requests and leaves
 *       states alone, a 429 with Retry-After holds later requests. The stats backfill runs until
 *       nothing is left, stops after 5 calls in a row with no progress (errors count), and on a
 *       configuration error.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { delay, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { poolsCollection } from "@/models/Pool";
import { emptyPackSync, type StoredPool } from "@/schemas/pool";
import { runStatsBackfill, syncPools } from "@/services/sync";
import { packInputHash, packInputOf } from "@/utils/pack-input";
import { setupTestDb } from "../../helpers/db";
import { setupMsw } from "../../helpers/msw";
import {
  createdAnswer,
  type PutCall,
  packsPutHandler,
  packsStatsHandler,
  slugFor,
  TEST_SERVICE,
} from "../../helpers/packs-server";
import { makePool, T0 } from "../../helpers/records";

setupTestDb();
const server = setupMsw();

const noWait = async (_ms: number): Promise<void> => {};

const poolNamed = (n: number, overrides: Partial<StoredPool> = {}): StoredPool =>
  makePool({
    _id: `otdb-${n}`,
    name: `Cup ${n} Finals`,
    slots: [{ mod: "NM", index: 1, beatmapId: 100 + n }],
    ...overrides,
  });

const hashOf = (pool: StoredPool) => packInputHash(packInputOf(pool));

describe("syncPools", () => {
  it("sends only due pools and stores each answer", async () => {
    const pools = await poolsCollection();
    const synced = poolNamed(2);
    const heldRejected = poolNamed(5);
    await pools.insertMany([
      poolNamed(1),
      {
        ...synced,
        pack: {
          ...emptyPackSync(),
          slug: slugFor("otdb-2"),
          state: "unchanged",
          listed: true,
          inputHash: hashOf(synced),
        },
      },
      poolNamed(3, { pack: { ...emptyPackSync(), state: "error", error: "packs answered 502." } }),
      poolNamed(4, { pack: { ...emptyPackSync(), state: "gone" } }),
      {
        ...heldRejected,
        pack: { ...emptyPackSync(), state: "rejected", inputHash: hashOf(heldRejected) },
      },
      poolNamed(6, { pack: { ...emptyPackSync(), state: "rejected", inputHash: "c".repeat(64) } }),
    ]);
    const calls: PutCall[] = [];
    server.use(
      packsPutHandler(
        (id) =>
          id === "otdb-6"
            ? HttpResponse.json(
                { error: { message: "Please keep the name free of slurs." } },
                { status: 400 },
              )
            : id === "otdb-3"
              ? HttpResponse.json({}, { status: 500 })
              : createdAnswer(id),
        calls,
      ),
    );
    const summary = await syncPools({ service: TEST_SERVICE, now: () => T0, sleep: noWait });
    expect(calls.map((call) => call.id).sort()).toEqual(["otdb-1", "otdb-3", "otdb-6"]);
    expect(summary).toMatchObject({ due: 3, sent: 3, remaining: 0, configError: null });
    expect(summary.states).toMatchObject({ created: 1, error: 1, rejected: 1 });
    expect((await pools.findOne({ _id: "otdb-1" }))?.pack).toEqual({
      slug: slugFor("otdb-1"),
      state: "created",
      listed: true,
      inputHash: hashOf(poolNamed(1)),
      syncedAt: T0,
      error: null,
    });
    expect((await pools.findOne({ _id: "otdb-6" }))?.pack).toMatchObject({
      state: "rejected",
      inputHash: hashOf(poolNamed(6)),
      error: "packs refused it (400): Please keep the name free of slurs.",
    });
    expect((await pools.findOne({ _id: "otdb-3" }))?.pack).toMatchObject({
      state: "error",
      inputHash: null,
    });
    calls.length = 0;
    await syncPools({ service: TEST_SERVICE, resyncRejected: true, now: () => T0, sleep: noWait });
    expect(calls.map((call) => call.id).sort()).toEqual(["otdb-3", "otdb-5", "otdb-6"]);
  });

  it("sends hidden and superseded pools unlisted, and only the ids asked for", async () => {
    const pools = await poolsCollection();
    await pools.insertMany([
      poolNamed(1, { hidden: true }),
      poolNamed(2, { supersededBy: "otdb-3" }),
      poolNamed(3),
    ]);
    const calls: PutCall[] = [];
    server.use(packsPutHandler((id) => createdAnswer(id), calls));
    await syncPools({ service: TEST_SERVICE, ids: ["otdb-1", "otdb-2"], sleep: noWait });
    expect(calls.map((call) => [call.id, call.body.visibility]).sort()).toEqual([
      ["otdb-1", "unlisted"],
      ["otdb-2", "unlisted"],
    ]);
  });

  it("sends at most the limit and counts the rest", async () => {
    const pools = await poolsCollection();
    await pools.insertMany([1, 2, 3].map((n) => poolNamed(n)));
    server.use(packsPutHandler((id) => createdAnswer(id)));
    expect(await syncPools({ service: TEST_SERVICE, limit: 2, sleep: noWait })).toMatchObject({
      due: 3,
      sent: 2,
      remaining: 1,
    });
  });

  it("stops sending on a 401 and leaves the pools as they were", async () => {
    const pools = await poolsCollection();
    await pools.insertMany(Array.from({ length: 12 }, (_, i) => poolNamed(i + 1)));
    const calls: PutCall[] = [];
    server.use(packsPutHandler(() => HttpResponse.json({}, { status: 401 }), calls));
    const summary = await syncPools({ service: TEST_SERVICE, sleep: noWait });
    expect(summary.configError).toMatch(/^packs refused the service token/);
    expect(summary.sent).toBe(0);
    expect(summary.remaining).toBe(12);
    expect(calls.length).toBeLessThanOrEqual(5);
    expect(await pools.countDocuments({ "pack.state": null })).toBe(12);
  });

  it("holds later requests after a 429 with Retry-After", async () => {
    const pools = await poolsCollection();
    await pools.insertMany(Array.from({ length: 6 }, (_, i) => poolNamed(i + 1)));
    // otdb-1 answers at once; the others take a moment, so otdb-1's lane picks up otdb-6.
    server.use(
      packsPutHandler(async (id) => {
        if (id === "otdb-1") {
          return HttpResponse.json({}, { status: 429, headers: { "Retry-After": "2" } });
        }
        await delay(50);
        return createdAnswer(id);
      }),
    );
    const sleep = vi.fn(noWait);
    const summary = await syncPools({ service: TEST_SERVICE, sleep });
    expect(summary.states).toMatchObject({ error: 1, created: 5 });
    expect(sleep).toHaveBeenCalled();
    expect(sleep.mock.calls.every(([ms]) => ms > 0 && ms <= 2000)).toBe(true);
  });
});

describe("runStatsBackfill", () => {
  const ok = (updated: number, remaining: number) => () =>
    HttpResponse.json({ updated, remaining });

  it("calls about once a minute until nothing is left", async () => {
    server.use(packsStatsHandler([ok(20, 40), ok(20, 20), ok(20, 0)]));
    const sleep = vi.fn(noWait);
    expect(await runStatsBackfill({ service: TEST_SERVICE, sleep })).toEqual({
      calls: 3,
      updated: 60,
      remaining: 0,
      stopped: "done",
      message: null,
    });
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(60_000);
  });

  it("stops after 5 calls in a row that update nothing, errors included", async () => {
    server.use(
      packsStatsHandler([
        ok(3, 10),
        ok(0, 10),
        () => HttpResponse.json({}, { status: 500 }),
        ok(0, 10),
        ok(0, 10),
        ok(0, 10),
      ]),
    );
    expect(await runStatsBackfill({ service: TEST_SERVICE, sleep: noWait })).toMatchObject({
      calls: 6,
      updated: 3,
      remaining: 10,
      stopped: "no-progress",
    });
  });

  it("stops on a configuration error", async () => {
    server.use(
      packsStatsHandler([() => HttpResponse.json({ code: "not_configured" }, { status: 503 })]),
    );
    expect(await runStatsBackfill({ service: TEST_SERVICE, sleep: noWait })).toMatchObject({
      calls: 1,
      stopped: "config",
      message: "packs has no service token set up (503 not_configured).",
    });
  });
});
