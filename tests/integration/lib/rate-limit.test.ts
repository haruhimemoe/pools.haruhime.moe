/**
 * @file tests/integration/lib/rate-limit.test.ts
 * @desc Fixed-window counters in rate_limits: hits counted per subject and window, refused past
 *       the limit with RateLimit headers and Retry-After, 429 no-store from refuseOverLimit, and
 *       counting that fails open.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { describe, expect, it, vi } from "vitest";
import { hitRateLimit, rateLimitHeaders, refuseOverLimit } from "@/lib/rate-limit";
import { setupTestDb } from "../../helpers/db";

setupTestDb();

const RULE = { scope: "test", limit: 2, windowSeconds: 60 };
const NOW = new Date("2026-09-24T12:00:30.000Z");

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

  it("answers 429 no-store once over", async () => {
    await refuseOverLimit(RULE, "9.9.9.9");
    expect(await refuseOverLimit(RULE, "9.9.9.9")).toBeNull();
    const response = await refuseOverLimit(RULE, "9.9.9.9");
    expect(response?.status).toBe(429);
    expect(response?.headers.get("cache-control")).toBe("no-store");
    expect(response?.headers.get("retry-after")).toMatch(/^\d+$/);
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
