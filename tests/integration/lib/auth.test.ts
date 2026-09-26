/**
 * @file tests/integration/lib/auth.test.ts
 * @desc Admin-only osu! sign-in against in-memory Mongo, osu! stubbed: the user hook sees the osu!
 *       id from the profile and refuses anyone not in ADMIN_OSU_IDS (no user row, no session, the
 *       callback lands on the error page); an admin signs in (PKCE, our callback, no osu! tokens
 *       kept); an id removed from the list loses its session at once and can't sign in again.
 *       Every failure lands on /signin with the error code: a refused osu! account back on the
 *       page it came from, and a callback with a bad state (no state to read the page from) on
 *       /signin?error=state_mismatch rather than better-auth's bare error page.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Sat Sep 26, 2026
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/auth/[...all]/route";
import { getAdminFromHeaders, osuProfileToUser, refuseNonAdminUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { ADMIN_OSU_ID, createTestAdmin } from "../../helpers/auth";
import { setupTestDb } from "../../helpers/db";

setupTestDb();
beforeEach(() => {
  vi.stubEnv("ADMIN_OSU_IDS", String(ADMIN_OSU_ID));
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.stubEnv("ADMIN_OSU_IDS", String(ADMIN_OSU_ID));
});

const PROFILE = (id: number) => ({
  id,
  username: `player${id}`,
  avatar_url: `https://a.ppy.sh/${id}`,
  country_code: "AU",
  country: { code: "AU" },
});

const cookiesFrom = (response: Response): string =>
  response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ");

const realFetch = globalThis.fetch;

const stubOsu = (profile: Record<string, unknown>) =>
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.startsWith("https://osu.ppy.sh/oauth/token")) {
      return Response.json({
        access_token: "a",
        refresh_token: "r",
        token_type: "Bearer",
        expires_in: 86400,
      });
    }
    if (url.startsWith("https://osu.ppy.sh/api/v2/me")) return Response.json(profile);
    return realFetch(input, init);
  });

/** Runs sign-in/social then the callback, as the browser would, with osu! stubbed. */
const signInWithOsu = async (profile: Record<string, unknown>): Promise<Response> => {
  const start = await POST(
    new Request("http://localhost:3000/api/auth/sign-in/social", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost:3000" },
      body: JSON.stringify({
        provider: "osu",
        callbackURL: "/admin",
        errorCallbackURL: "/signin?next=%2Fadmin",
      }),
    }),
  );
  const { url } = (await start.json()) as { url: string };
  const target = new URL(url);
  expect(target.searchParams.get("code_challenge_method")).toBe("S256");
  expect(target.searchParams.get("redirect_uri")).toBe(
    "http://localhost:3000/api/auth/callback/osu",
  );
  stubOsu(profile);
  return GET(
    new Request(
      `http://localhost:3000/api/auth/callback/osu?code=abc&state=${target.searchParams.get("state") ?? ""}`,
      {
        headers: { cookie: cookiesFrom(start) },
      },
    ),
  );
};

describe("sign-in errors", () => {
  it("sends a callback with a bad state to /signin?error=state_mismatch, not a 500", async () => {
    const callback = await GET(
      new Request("http://localhost:3000/api/auth/callback/osu?code=abc&state=forged"),
    );
    expect(callback.status).toBe(302);
    expect(callback.headers.get("location")).toBe(
      "http://localhost:3000/signin?error=state_mismatch",
    );
  });
});

describe("the user hook", () => {
  it("sees the osu! id the profile maps to, and refuses anyone not listed", () => {
    expect(refuseNonAdminUser(osuProfileToUser(PROFILE(ADMIN_OSU_ID)))).toBeUndefined();
    expect(refuseNonAdminUser(osuProfileToUser(PROFILE(2)))).toBe(false);
    expect(refuseNonAdminUser({})).toBe(false);
  });
});

describe("osu! sign-in", () => {
  it("signs an admin in and keeps no osu! tokens", async () => {
    const callback = await signInWithOsu(PROFILE(ADMIN_OSU_ID));
    expect(callback.headers.get("location")).toBe("/admin");
    expect(await getAdminFromHeaders(new Headers({ cookie: cookiesFrom(callback) }))).toMatchObject(
      {
        osuId: ADMIN_OSU_ID,
        username: `player${ADMIN_OSU_ID}`,
      },
    );
    const account = await getDb().collection("account").findOne({ providerId: "osu" });
    expect(account?.accessToken ?? null).toBeNull();
    expect(account?.refreshToken ?? null).toBeNull();
  });

  it("refuses anyone else: no user, no session, the error page", async () => {
    const callback = await signInWithOsu(PROFILE(2));
    expect(callback.headers.get("location")).toBe(
      "/signin?next=%2Fadmin&error=unable_to_create_user",
    );
    expect(await getDb().collection("user").countDocuments({ osuId: 2 })).toBe(0);
    expect(await getDb().collection("session").countDocuments()).toBe(0);
  });

  it("drops a removed admin's session at once and refuses a new one", async () => {
    const admin = await createTestAdmin();
    const headers = new Headers({ cookie: admin.cookie });
    expect(await getAdminFromHeaders(headers)).not.toBeNull();
    vi.stubEnv("ADMIN_OSU_IDS", "1");
    expect(await getAdminFromHeaders(headers)).toBeNull();
    const again = await signInWithOsu(PROFILE(ADMIN_OSU_ID));
    expect(again.headers.get("location") ?? "").toContain("error");
    expect(await getDb().collection("session").countDocuments()).toBe(1);
  });

  it("fails closed on a malformed ADMIN_OSU_IDS", async () => {
    const admin = await createTestAdmin();
    vi.stubEnv("ADMIN_OSU_IDS", "not-ids");
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await getAdminFromHeaders(new Headers({ cookie: admin.cookie }))).toBeNull();
  });
});
