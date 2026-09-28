/**
 * @file tests/integration/lib/auth.test.ts
 * @desc osu! sign-in for everyone against in-memory Mongo, osu! stubbed: any osu! user signs in
 *       (PKCE, our callback, no osu! tokens kept) and gets a user row and a session; admin rights
 *       come only from ADMIN_OSU_IDS, read per request, so a removed id stays signed in as a user
 *       but stops being an admin at once, and a malformed list makes nobody an admin.
 *       getUserFromHeaders reads the caller. A callback with a bad state lands on
 *       /signin?error=state_mismatch rather than better-auth's bare error page. The readable
 *       signed-in marker follows the session: set on sign-in and by a get-session that finds one,
 *       cleared by one that doesn't and on sign-out.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Sun Sep 27, 2026
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/auth/[...all]/route";
import { getAdminFromHeaders, getUserFromHeaders } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { SIGNED_IN_COOKIE } from "@/lib/signed-in-marker";
import { ADMIN_OSU_ID, createTestAdmin, createTestUser } from "../../helpers/auth";
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

  it("signs in any osu! user, who isn't an admin", async () => {
    const callback = await signInWithOsu(PROFILE(2));
    expect(callback.headers.get("location")).toBe("/admin");
    const headers = new Headers({ cookie: cookiesFrom(callback) });
    expect(await getUserFromHeaders(headers)).toMatchObject({
      osuId: 2,
      username: "player2",
      avatarUrl: "https://a.ppy.sh/2",
      isAdmin: false,
    });
    expect(await getAdminFromHeaders(headers)).toBeNull();
    expect(await getDb().collection("user").countDocuments({ osuId: 2 })).toBe(1);
    const account = await getDb().collection("account").findOne({ accountId: "2" });
    expect(account?.accessToken ?? null).toBeNull();
  });

  it("keeps a removed admin signed in as a user, no longer an admin", async () => {
    const admin = await createTestAdmin();
    const headers = new Headers({ cookie: admin.cookie });
    expect(await getUserFromHeaders(headers)).toMatchObject({ isAdmin: true });
    vi.stubEnv("ADMIN_OSU_IDS", "1");
    expect(await getAdminFromHeaders(headers)).toBeNull();
    expect(await getUserFromHeaders(headers)).toMatchObject({ id: admin.id, isAdmin: false });
    const again = await signInWithOsu(PROFILE(ADMIN_OSU_ID));
    expect(again.headers.get("location")).toBe("/admin");
    expect(await getDb().collection("session").countDocuments()).toBe(2);
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
      isAdmin: false,
    });
    expect(await getUserFromHeaders(new Headers())).toBeNull();
    expect(
      await getUserFromHeaders(new Headers({ cookie: "better-auth.session_token=forged.sig" })),
    ).toBeNull();
  });
});

/** The marker's Set-Cookie line from a response, or undefined. */
const markerFrom = (response: Response): string | undefined =>
  response.headers.getSetCookie().find((cookie) => cookie.startsWith(`${SIGNED_IN_COOKIE}=`));

const authRequest = (path: string, cookie: string, method = "GET") =>
  new Request(`http://localhost:3000/api/auth/${path}`, {
    method,
    headers: { cookie, origin: "http://localhost:3000" },
  });

describe("signed-in marker cookie", () => {
  it("is set, readable by the page, when osu! sign-in completes", async () => {
    const marker = markerFrom(await signInWithOsu(PROFILE(3)));
    expect(marker).toMatch(/^pools-signed-in=1;/);
    expect(marker).toMatch(/Max-Age=\d{5,}/);
    expect(marker).toMatch(/Path=\//);
    expect(marker).not.toMatch(/HttpOnly/i);
  });

  it("is refreshed by a get-session that finds a session", async () => {
    const user = await createTestUser(4);
    expect(markerFrom(await GET(authRequest("get-session", user.cookie)))).toMatch(
      /^pools-signed-in=1;/,
    );
  });

  it("is cleared by a get-session without a session, and on sign-out", async () => {
    expect(markerFrom(await GET(authRequest("get-session", "pools-signed-in=1")))).toMatch(
      /^pools-signed-in=;.*Max-Age=0/,
    );
    const user = await createTestUser(6);
    expect(markerFrom(await POST(authRequest("sign-out", user.cookie, "POST")))).toMatch(
      /^pools-signed-in=;.*Max-Age=0/,
    );
  });
});
