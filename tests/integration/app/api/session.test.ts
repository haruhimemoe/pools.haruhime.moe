/**
 * @file tests/integration/app/api/session.test.ts
 * @desc GET /api/session: the hub's session read with no writes to identity; a visitor, a
 *       forged cookie and a banned user all read as null.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Oct 6, 2026
 * @modified Tue Oct 6, 2026
 */

import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/session/route";
import { getIdentityDb } from "@/lib/db";
import { createTestUser } from "../../../helpers/auth";
import { setupTestDb } from "../../../helpers/db";
import { poolRequest } from "../../../helpers/pool-requests";

setupTestDb();

const read = async (cookie: string | null) => {
  const response = await GET(poolRequest("GET", "/api/session", cookie));
  expect(response.headers.get("cache-control")).toContain("no-store");
  return (await response.json()) as { user: Record<string, unknown> | null };
};

describe("GET /api/session", () => {
  it("returns the signed-in user and writes nothing to identity", async () => {
    const user = await createTestUser(4242, "someone");
    const before = await getIdentityDb().collection("session").findOne({});
    expect(await read(user.cookie)).toEqual({
      user: { id: user.id, username: "someone", avatarUrl: null },
    });
    expect(await getIdentityDb().collection("session").findOne({})).toEqual(before);
  });

  it("returns null for a visitor, a forged cookie and a banned user", async () => {
    expect(await read(null)).toEqual({ user: null });
    const user = await createTestUser(4243);
    expect(await read(user.cookie.replace(/.{4}$/, "AAAA"))).toEqual({ user: null });
    const banned = await createTestUser(4244, "banned", { bannedAt: new Date() });
    expect(await read(banned.cookie)).toEqual({ user: null });
  });
});
