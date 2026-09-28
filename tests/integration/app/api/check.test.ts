/**
 * @file tests/integration/app/api/check.test.ts
 * @desc GET /api/check: bad ids are 400; a complete answer is cached 5 minutes on the CDN (its
 *       map labels and usage come from pools, so a hidden pool leaves it within 5 minutes), a
 *       partial one isn't, and neither is one whose maps lookup failed; what pools knows about
 *       each map comes along (usage from current pools only, no label for a map only hidden pools
 *       have); 30 checks a minute per IP.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Mon Sep 28, 2026
 */

import { rateLimitId, windowFor } from "@haruhimemoe/next-kit/server";
import { setupMsw } from "@haruhimemoe/next-kit/testing";
import { Collection } from "mongodb";
import { describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/check/route";
import { OSU_API_BUDGET } from "@/constants/compliance";
import { MAPS_COLLECTION, RATE_LIMITS_COLLECTION } from "@/constants/db";
import { getDb } from "@/lib/db";
import { mapsCollection } from "@/models/Map";
import type { CheckResponse } from "@/schemas/compliance";
import { setupTestDb } from "../../../helpers/db";
import { osuHandlers } from "../../../helpers/osu-server";
import { makeMap } from "../../../helpers/records";

/** The osu! budget's counter for a rule, subject and time. */
const budgetWindow = (
  rule: { scope: string; limit: number; windowSeconds: number },
  subject: string,
  nowMs: number,
) => ({ id: rateLimitId(rule, subject, nowMs), expiresAt: windowFor(rule, nowMs).expiresAt });

setupTestDb();
setupMsw(...osuHandlers);

const get = (ids: string, ip = "203.0.113.9") =>
  GET(new Request(`http://localhost:3000/api/check?ids=${ids}`, { headers: { "x-real-ip": ip } }));

describe("GET /api/check", () => {
  it.each(["", "abc", "0", Array.from({ length: 65 }, (_, i) => i + 1).join(",")])(
    "refuses ids=%j",
    async (ids) => {
      const response = await get(ids);
      expect(response.status).toBe(400);
      expect(response.headers.get("cache-control")).toBe("no-store");
    },
  );

  it("caches a complete answer 5 minutes and brings what pools knows about each map", async () => {
    await (await mapsCollection()).insertMany([
      makeMap({
        _id: 75,
        title: "DISCOPRINCE",
        artist: "Kenji Ninuma",
        version: "Normal",
        usage: { count: 3, lastYear: 2023, playedAs: ["NM"], shown: true },
      }),
      makeMap({ _id: 1001, usage: { count: 0, lastYear: null, playedAs: [], shown: false } }),
    ]);
    const response = await get("75,1001");
    expect(response.headers.get("cache-control")).toBe("public, s-maxage=300");
    const body = (await response.json()) as CheckResponse;
    expect(body.maps).toEqual({
      "75": { label: "Kenji Ninuma - DISCOPRINCE [Normal]", count: 3, lastYear: 2023 },
      "1001": { label: null, count: 0, lastYear: null },
    });
  });

  it("never caches an answer whose maps lookup failed", async () => {
    const find = Collection.prototype.find;
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(Collection.prototype, "find").mockImplementation(function (
      this: Collection,
      ...args: Parameters<Collection["find"]>
    ) {
      if (this.collectionName === MAPS_COLLECTION) throw new Error("operation exceeded time limit");
      return find.apply(this, args);
    } as Collection["find"]);
    try {
      const response = await get("75");
      const body = (await response.json()) as CheckResponse;
      expect(body.unchecked).toEqual([]);
      expect(body.sets.map((set) => set.setId)).toEqual([1]);
      expect(body.maps).toEqual({});
      expect(response.headers.get("cache-control")).toBe("no-store");
    } finally {
      vi.restoreAllMocks();
    }
  });

  it("never caches a partial answer", async () => {
    const window = budgetWindow(OSU_API_BUDGET, OSU_API_BUDGET.subject, Date.now());
    await getDb()
      .collection(RATE_LIMITS_COLLECTION)
      .insertOne({ _id: window.id as never, count: 50, expiresAt: window.expiresAt });
    const response = await get("75");
    expect(((await response.json()) as CheckResponse).unchecked).toEqual([75]);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("allows 30 checks a minute per IP", async () => {
    for (let i = 0; i < 30; i++) expect((await get("75", "198.51.100.3")).status).toBe(200);
    expect((await get("75", "198.51.100.3")).status).toBe(429);
  });
});
