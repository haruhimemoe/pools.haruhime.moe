/**
 * @file tests/integration/app/api/v1-me.test.ts
 * @desc GET /api/v1/me with an hpl_ key: a valid key answers the owner with RateLimit headers
 *       and no-store; a missing, revoked or other-app (hpk_) key answers 401; the 21st failed
 *       call from one IP in a minute answers 429.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sat Oct 3, 2026
 * @modified Sat Oct 3, 2026
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/v1/me/route";
import { apiKeys } from "@/lib/api-keys";
import { createTestUser } from "../../../helpers/auth";
import { setupTestDb } from "../../../helpers/db";

setupTestDb();
afterEach(() => vi.useRealTimers());

/** A fixed time, so created dates are known. */
const freezeTime = () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-22T12:00:10.000Z"));
};

const call = (key?: string, ip = "203.0.113.7") =>
  GET(
    new Request("http://localhost:3000/api/v1/me", {
      headers: { "x-real-ip": ip, ...(key ? { authorization: `Bearer ${key}` } : {}) },
    }),
    undefined,
  );

describe("GET /api/v1/me", () => {
  it("answers the key's owner, with rate-limit headers and no-store", async () => {
    freezeTime();
    const user = await createTestUser(2, "peppy");
    const { key } = await apiKeys.issue(user.id);
    expect(key.startsWith("hpl_")).toBe(true);
    const response = await call(key);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      user: { id: user.id, osuId: 2, username: "peppy" },
    });
    expect(response.headers.get("RateLimit-Limit")).toBe("60");
    expect(response.headers.get("RateLimit-Remaining")).toBe("59");
    // pools' limiter keeps the real clock, so the reset is only checked for shape.
    expect(Number(response.headers.get("RateLimit-Reset"))).toBeLessThanOrEqual(60);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("asks for a key when none is sent", async () => {
    const response = await call();
    expect(response.status).toBe(401);
    expect(response.headers.get("WWW-Authenticate")).toBe("Bearer");
    expect(await response.json()).toMatchObject({
      error: { code: "unauthorized", message: expect.stringContaining("hpl_") },
    });
  });

  it("refuses a revoked key", async () => {
    const user = await createTestUser(2);
    const { key } = await apiKeys.issue(user.id);
    await apiKeys.revoke(user.id);
    const response = await call(key);
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: { code: "invalid_api_key" } });
  });

  it("refuses another app's key (hpk_)", async () => {
    const response = await call(`hpk_${"A".repeat(43)}`);
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: { code: "invalid_api_key" } });
  });

  it("answers 429 to the 21st failed call from one IP in a minute", async () => {
    freezeTime();
    for (let i = 0; i < 20; i++) expect((await call("hpl_bad")).status).toBe(401);
    const refused = await call("hpl_bad");
    expect(refused.status).toBe(429);
    expect(await refused.json()).toMatchObject({ error: { code: "rate_limited" } });
    expect((await call("hpl_bad", "198.51.100.1")).status).toBe(401);
  });
});
