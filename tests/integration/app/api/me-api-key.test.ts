/**
 * @file tests/integration/app/api/me-api-key.test.ts
 * @desc /api/me/api-key (session auth): read, create, regenerate, revoke, the cross-site refusal
 *       and the 10-per-hour create limit.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sat Oct 3, 2026
 * @modified Sat Oct 3, 2026
 */

import { type ApiKeyCreated, hashApiKey } from "@haruhimemoe/next-kit/api-keys";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DELETE, GET, POST } from "@/app/api/me/api-key/route";
import { apiKeys } from "@/lib/api-keys";
import { createTestUser } from "../../../helpers/auth";
import { setupTestDb } from "../../../helpers/db";

setupTestDb();
afterEach(() => vi.useRealTimers());

const URL = "http://localhost:3000/api/me/api-key";
const request = (method: string, cookie?: string, headers: Record<string, string> = {}) =>
  new Request(URL, { method, headers: { ...(cookie ? { cookie } : {}), ...headers } });
const read = (cookie?: string) => GET(request("GET", cookie));
const create = (cookie?: string) => POST(request("POST", cookie));
const revoke = (cookie?: string) => DELETE(request("DELETE", cookie));
const created = async (response: Response) => (await response.json()) as ApiKeyCreated;
const owner = async (key: string) => (await apiKeys.authenticate(key))?.userId ?? null;

const freezeTime = () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-22T12:00:10.000Z"));
};

describe("/api/me/api-key", () => {
  it("asks signed-out callers to sign in", async () => {
    for (const response of [await read(), await create(), await revoke()]) {
      expect(response.status).toBe(401);
      expect(await response.json()).toMatchObject({ error: { code: "unauthorized" } });
    }
  });

  it("creates an hpl_ key, shows it once, then only its prefix and dates", async () => {
    freezeTime();
    const user = await createTestUser(2);
    const empty = await read(user.cookie);
    expect(await empty.json()).toEqual({ apiKey: null });
    expect(empty.headers.get("Cache-Control")).toBe("no-store");

    const response = await create(user.cookie);
    expect(response.status).toBe(201);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("RateLimit-Limit")).toBe("10");
    expect(response.headers.get("RateLimit-Remaining")).toBe("9");
    const body = await created(response);
    expect(body.key.startsWith("hpl_")).toBe(true);
    expect(body.apiKey).toEqual({
      prefix: body.key.slice(0, 12),
      createdAt: "2026-09-22T12:00:10.000Z",
      lastUsedAt: null,
    });

    const text = await (await read(user.cookie)).text();
    expect(JSON.parse(text)).toEqual({ apiKey: body.apiKey });
    expect(text).not.toContain(body.key);
    expect(text).not.toContain(hashApiKey(body.key));
  });

  it("regenerates: the old key stops working at once", async () => {
    const user = await createTestUser(2);
    const first = await created(await create(user.cookie));
    const second = await created(await create(user.cookie));
    expect(await owner(first.key)).toBeNull();
    expect(await owner(second.key)).toBe(user.id);
  });

  it("revokes, then answers 404 when there is nothing to revoke", async () => {
    const user = await createTestUser(2);
    const { key } = await created(await create(user.cookie));
    expect((await revoke(user.cookie)).status).toBe(204);
    expect(await owner(key)).toBeNull();
    const again = await revoke(user.cookie);
    expect(again.status).toBe(404);
    expect(await again.json()).toEqual({
      error: { code: "not_found", message: "You don't have an API key." },
    });
  });

  it("allows 10 creates an hour, then answers 429 and keeps the last key", async () => {
    freezeTime();
    const user = await createTestUser(2);
    let last = "";
    for (let i = 0; i < 10; i++) {
      const response = await create(user.cookie);
      expect(response.status).toBe(201);
      last = (await created(response)).key;
    }
    const refused = await create(user.cookie);
    expect(refused.status).toBe(429);
    // pools' limiter keeps the real clock, so the wait is only checked for range.
    expect(Number(refused.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(Number(refused.headers.get("Retry-After"))).toBeLessThanOrEqual(3600);
    expect(await refused.json()).toMatchObject({ error: { code: "rate_limited" } });
    expect(await owner(last)).toBe(user.id);
  });

  it("refuses a create or revoke from another site, key untouched", async () => {
    const user = await createTestUser(2);
    const { key } = await created(await create(user.cookie));
    const foreign: Record<string, string>[] = [
      { origin: "https://evil.test" },
      { "sec-fetch-site": "cross-site" },
    ];
    for (const headers of foreign) {
      for (const [method, handler] of [
        ["POST", POST],
        ["DELETE", DELETE],
      ] as const) {
        expect((await handler(request(method, user.cookie, headers))).status).toBe(403);
      }
    }
    expect(await owner(key)).toBe(user.id);
  });
});
