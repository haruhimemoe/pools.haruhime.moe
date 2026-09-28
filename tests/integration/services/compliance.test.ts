/**
 * @file tests/integration/services/compliance.test.ts
 * @desc The check against osu! (msw) and the in-memory cache: one verdict per beatmapset with the
 *       package's wording (ok and ranked, artist, a closer look with notes, a DMCA'd ranked map),
 *       unknown ids missing; a second check answered from the cache with no osu! call, found by
 *       difficulty id or through pools' own maps; stale facts asked again; a spent global budget
 *       or IP share, an osu! failure and a database outage leave maps unchecked, never guessed.
 *       What pools knows about each map, or null when that lookup fails.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Mon Sep 28, 2026
 */

import { rateLimitId, windowFor } from "@haruhimemoe/next-kit/server";
import { setupMsw } from "@haruhimemoe/next-kit/testing";
import { Collection } from "mongodb";
import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OSU_API_BUDGET, OSU_API_BUDGET_PER_IP } from "@/constants/compliance";
import { RATE_LIMITS_COLLECTION, SET_FACTS_COLLECTION } from "@/constants/db";
import { getDb } from "@/lib/db";
import { mapsCollection } from "@/models/Map";
import { checkCompliance, checkMaps } from "@/services/compliance";
import { setupTestDb } from "../../helpers/db";
import { osuCalls, osuHandlers } from "../../helpers/osu-server";
import { makeMap } from "../../helpers/records";

/** The osu! budget's counter for a rule, subject and time. */
const budgetWindow = (
  rule: { scope: string; limit: number; windowSeconds: number },
  subject: string,
  nowMs: number,
) => ({ id: rateLimitId(rule, subject, nowMs), expiresAt: windowFor(rule, nowMs).expiresAt });

setupTestDb();
const server = setupMsw(...osuHandlers);
beforeEach(() => {
  osuCalls.beatmaps = 0;
});

// Real time: the TTL monitor deletes facts older than a day by the real clock.
const NOW = Date.now();
const now = () => NOW;

describe("checkCompliance", () => {
  it("gives one verdict per beatmapset, with the package's wording", async () => {
    const result = await checkCompliance([1004, 75, 1002, 1003, 1001, 999_999, 75], { now });
    expect(result.missing).toEqual([999_999]);
    expect(result.unchecked).toEqual([]);
    expect(result.sets).toEqual([
      { setId: 1, beatmapIds: [75], status: "ok", text: "Allowed", ranked: true },
      {
        setId: 101,
        beatmapIds: [1001, 1004],
        status: "disallowed",
        reason: "artist",
        text: "This artist doesn't allow their music in osu!",
        ranked: false,
      },
      expect.objectContaining({
        setId: 102,
        beatmapIds: [1002],
        status: "potential",
        notes: expect.any(String),
        ranked: false,
      }),
      expect.objectContaining({
        setId: 103,
        beatmapIds: [1003],
        status: "disallowed",
        reason: "dmca",
        ranked: true,
      }),
    ]);
    expect(osuCalls.beatmaps).toBe(1);
  });

  it("answers a second check from the cache, by difficulty or through pools' maps", async () => {
    await checkCompliance([75, 1001], { now });
    await (await mapsCollection()).insertOne(makeMap({ _id: 1005, setId: 101 }));
    osuCalls.beatmaps = 0;
    const again = await checkCompliance([75, 1001, 1005], { now });
    expect(osuCalls.beatmaps).toBe(0);
    expect(again.sets.map((set) => [set.setId, set.beatmapIds])).toEqual([
      [1, [75]],
      [101, [1001, 1005]],
    ]);
    const cached = await getDb()
      .collection(SET_FACTS_COLLECTION)
      .findOne({ _id: 101 as never });
    expect(cached).toMatchObject({ artist: "Igorrr", beatmapIds: [1001] });
  });

  it("asks osu! again once the facts are a day old", async () => {
    await checkCompliance([75], { now: () => NOW - 25 * 3600 * 1000 });
    osuCalls.beatmaps = 0;
    await checkCompliance([75], { now });
    expect(osuCalls.beatmaps).toBe(1);
  });

  it("leaves maps unchecked when the global budget or the IP's share is spent", async () => {
    const counters = getDb().collection(RATE_LIMITS_COLLECTION);
    const global = budgetWindow(OSU_API_BUDGET, OSU_API_BUDGET.subject, NOW);
    await counters.insertOne({ _id: global.id as never, count: 50, expiresAt: global.expiresAt });
    expect(await checkCompliance([75], { now })).toEqual({
      sets: [],
      missing: [],
      unchecked: [75],
    });
    await counters.deleteMany({});
    const share = budgetWindow(OSU_API_BUDGET_PER_IP, "203.0.113.7", NOW);
    await counters.insertOne({ _id: share.id as never, count: 20, expiresAt: share.expiresAt });
    expect(await checkCompliance([75], { now, subject: "203.0.113.7" })).toEqual({
      sets: [],
      missing: [],
      unchecked: [75],
    });
    expect(osuCalls.beatmaps).toBe(0);
  });

  it("leaves maps unchecked when osu! fails or the database is down", async () => {
    server.use(
      http.get("https://osu.ppy.sh/api/v2/beatmaps", () => HttpResponse.json({}, { status: 500 })),
    );
    expect(await checkCompliance([75, 1001], { now })).toEqual({
      sets: [],
      missing: [],
      unchecked: [75, 1001],
    });
    const down = () => Promise.reject(new Error("down"));
    expect(await checkCompliance([75], { now, db: down })).toEqual({
      sets: [],
      missing: [],
      unchecked: [75],
    });
  });
});

describe("checkMaps", () => {
  it("gives each map pools has its label and usage, and null when the lookup fails", async () => {
    await (await mapsCollection()).insertOne(
      makeMap({
        _id: 75,
        title: "DISCOPRINCE",
        artist: "Kenji Ninuma",
        version: "Normal",
        usage: { count: 2, lastYear: 2022, playedAs: ["NM"], shown: true },
      }),
    );
    expect(await checkMaps([75, 76])).toEqual({
      "75": { label: "Kenji Ninuma - DISCOPRINCE [Normal]", count: 2, lastYear: 2022 },
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(Collection.prototype, "find").mockImplementation(() => {
      throw new Error("operation exceeded time limit");
    });
    try {
      expect(await checkMaps([75])).toBeNull();
    } finally {
      vi.restoreAllMocks();
    }
  });
});
