/**
 * @file tests/integration/app/api/check.test.ts
 * @desc GET /api/check: bad ids are 400; a complete answer is cached a day on the CDN and a
 *       partial one isn't; what pools knows about each map comes along (usage from current pools
 *       only, no label for a map only hidden pools have); 30 checks a minute per IP.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/check/route";
import { RATE_LIMITS_COLLECTION } from "@/constants/db";
import { getDb } from "@/lib/db";
import { osuBudgetWindow } from "@/lib/osu-budget";
import { mapsCollection } from "@/models/Map";
import type { CheckResponse } from "@/schemas/compliance";
import { setupTestDb } from "../../../helpers/db";
import { setupMsw } from "../../../helpers/msw";
import { osuHandlers } from "../../../helpers/osu-server";
import { makeMap } from "../../../helpers/records";

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

  it("caches a complete answer and brings what pools knows about each map", async () => {
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
    expect(response.headers.get("cache-control")).toBe(
      "public, s-maxage=86400, stale-while-revalidate=604800",
    );
    const body = (await response.json()) as CheckResponse;
    expect(body.maps).toEqual({
      "75": { label: "Kenji Ninuma - DISCOPRINCE [Normal]", count: 3, lastYear: 2023 },
      "1001": { label: null, count: 0, lastYear: null },
    });
  });

  it("never caches a partial answer", async () => {
    const window = osuBudgetWindow(Date.now());
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
