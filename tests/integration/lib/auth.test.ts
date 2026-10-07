/**
 * @file tests/integration/lib/auth.test.ts
 * @desc Reading the haruhime.moe hub's session against in-memory Mongo: getUserFromHeaders reads
 *       the caller from identity, or null without a session, with a forged cookie or for a banned
 *       user; admin rights come only from ADMIN_OSU_IDS, read per request, so a removed id stays
 *       signed in as a user but stops being an admin at once, and a malformed list makes nobody an
 *       admin.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Tue Oct 6, 2026
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getAdminFromHeaders, getUserFromHeaders } from "@/lib/auth";
import { ADMIN_OSU_ID, createTestAdmin, createTestUser } from "../../helpers/auth";
import { setupTestDb } from "../../helpers/db";

setupTestDb();
beforeEach(() => {
  vi.stubEnv("ADMIN_OSU_IDS", String(ADMIN_OSU_ID));
});
afterEach(() => {
  vi.stubEnv("ADMIN_OSU_IDS", String(ADMIN_OSU_ID));
});

describe("admin rights", () => {
  it("keeps a removed admin signed in as a user, no longer an admin", async () => {
    const admin = await createTestAdmin();
    const headers = new Headers({ cookie: admin.cookie });
    expect(await getUserFromHeaders(headers)).toMatchObject({ isAdmin: true });
    expect(await getAdminFromHeaders(headers)).toMatchObject({ id: admin.id });
    vi.stubEnv("ADMIN_OSU_IDS", "1");
    expect(await getAdminFromHeaders(headers)).toBeNull();
    expect(await getUserFromHeaders(headers)).toMatchObject({ id: admin.id, isAdmin: false });
  });

  it("fails closed on a malformed ADMIN_OSU_IDS", async () => {
    const admin = await createTestAdmin();
    vi.stubEnv("ADMIN_OSU_IDS", "not-ids");
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await getAdminFromHeaders(new Headers({ cookie: admin.cookie }))).toBeNull();
  });
});

describe("getUserFromHeaders", () => {
  it("reads the caller, or null without a session", async () => {
    const user = await createTestUser(5, "peppy");
    expect(await getUserFromHeaders(new Headers({ cookie: user.cookie }))).toEqual({
      id: user.id,
      osuId: 5,
      username: "peppy",
      avatarUrl: null,
      bannedAt: null,
      banReason: null,
      isAdmin: false,
    });
    expect(await getUserFromHeaders(new Headers())).toBeNull();
    expect(
      await getUserFromHeaders(new Headers({ cookie: "better-auth.session_token=forged.sig" })),
    ).toBeNull();
  });

  it("reads a banned user as signed out", async () => {
    const banned = await createTestUser(6, "banned", { bannedAt: new Date() });
    expect(await getUserFromHeaders(new Headers({ cookie: banned.cookie }))).toBeNull();
  });
});
