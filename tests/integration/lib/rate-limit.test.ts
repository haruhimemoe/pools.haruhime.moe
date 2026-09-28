/**
 * @file tests/integration/lib/rate-limit.test.ts
 * @desc Fixed-window counters in rate_limits: hits counted per subject and window, refused past
 *       the limit with RateLimit headers and Retry-After, 429 no-store from refuseOverLimit, a
 *       hit that costs more than one (a call carrying several ops), and counting that fails open.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Mon Sep 28, 2026
 */

import { createRateLimiter, rateLimitHeaders } from "@haruhimemoe/next-kit/server";
import { describe, expect, it, vi } from "vitest";
import { RATE_LIMITS_COLLECTION } from "@/constants/db";
import { connectedDb, getDb } from "@/lib/db";
import { refuseOverLimit } from "@/lib/rate-limit";
import { setupTestDb } from "../../helpers/db";

setupTestDb();

const RULE = { scope: "test", limit: 2, windowSeconds: 60 };
const NOW = new Date("2026-09-24T12:00:30.000Z");

/** pools' limiter settings with a clock and database the test controls. */
const hitRateLimit = (
  rule: typeof RULE,
  subject: string,
  now = NOW,
  db: () => ReturnType<typeof connectedDb> = connectedDb,
  cost = 1,
) =>
  createRateLimiter({ db, collection: RATE_LIMITS_COLLECTION, now: () => now.getTime() }).hit(
    rule,
    subject,
    cost,
  );

describe("hitRateLimit", () => {
  it("allows up to the limit per subject and window", async () => {
    expect(await hitRateLimit(RULE, "1.2.3.4", NOW)).toMatchObject({
      allowed: true,
      remaining: 1,
      resetSeconds: 30,
    });
    expect(await hitRateLimit(RULE, "1.2.3.4", NOW)).toMatchObject({ allowed: true, remaining: 0 });
    const refused = await hitRateLimit(RULE, "1.2.3.4", NOW);
    expect(refused).toMatchObject({ allowed: false, remaining: 0 });
    expect(rateLimitHeaders(refused)).toEqual({
      "RateLimit-Limit": "2",
      "RateLimit-Remaining": "0",
      "RateLimit-Reset": "30",
      "Retry-After": "30",
    });
    expect(await hitRateLimit(RULE, "5.6.7.8", NOW)).toMatchObject({ allowed: true });
    expect(await hitRateLimit(RULE, "1.2.3.4", new Date("2026-09-24T12:01:01.000Z"))).toMatchObject(
      { allowed: true },
    );
  });

  it("keeps pools' counters in rate_limits", async () => {
    await refuseOverLimit(RULE, "8.8.8.8");
    expect(await getDb().collection(RATE_LIMITS_COLLECTION).countDocuments()).toBe(1);
  });

  it("answers 429 no-store once over", async () => {
    await refuseOverLimit(RULE, "9.9.9.9");
    expect(await refuseOverLimit(RULE, "9.9.9.9")).toBeNull();
    const response = await refuseOverLimit(RULE, "9.9.9.9");
    expect(response?.status).toBe(429);
    expect(response?.headers.get("cache-control")).toBe("no-store");
    expect(response?.headers.get("retry-after")).toMatch(/^\d+$/);
  });

  it("counts a hit's cost, refusing one that would go past the limit", async () => {
    const rule = { scope: "cost", limit: 5, windowSeconds: 60 };
    expect(await hitRateLimit(rule, "u1", NOW, undefined, 3)).toMatchObject({
      allowed: true,
      remaining: 2,
    });
    expect(await hitRateLimit(rule, "u1", NOW, undefined, 3)).toMatchObject({
      allowed: false,
      remaining: 0,
    });
    expect(await refuseOverLimit(rule, "u2", 5)).toBeNull();
    expect((await refuseOverLimit(rule, "u2", 1))?.status).toBe(429);
  });

  it("fails open when counting fails", async () => {
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    const down = () => Promise.reject(new Error("down"));
    expect(await hitRateLimit(RULE, "1.1.1.1", NOW, down)).toMatchObject({
      allowed: true,
      remaining: 2,
    });
    quiet.mockRestore();
  });
});
