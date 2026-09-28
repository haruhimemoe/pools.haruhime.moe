/**
 * @file tests/unit/lib/osu-users.test.ts
 * @desc Looking an osu! user up by username (osu! stubbed with msw): a client-credentials token
 *       (cached, fetched again once after a 401), GET /api/v2/users/@<name> with our User-Agent,
 *       found or missing (404), and unavailable when the budget says no, osu! fails or answers
 *       something unreadable.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Mon Sep 28, 2026
 */

import { setupMsw } from "@haruhimemoe/next-kit/testing";
import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { SERVER_USER_AGENT } from "@/constants/site";
import { forgetOsuUserToken, lookupOsuUser } from "@/lib/osu-users";

const server = setupMsw();
const CREDENTIALS = () => ({ clientId: "1", clientSecret: "secret" });
const USERS = "https://osu.ppy.sh/api/v2/users/:user";
let tokens = 0;

const tokenHandler = http.post("https://osu.ppy.sh/oauth/token", () => {
  tokens += 1;
  return HttpResponse.json({ access_token: `t${tokens}`, token_type: "Bearer", expires_in: 86400 });
});

beforeEach(() => {
  tokens = 0;
  forgetOsuUserToken();
  server.use(tokenHandler);
});

const lookup = (username: string, beforeCall?: () => Promise<boolean>) =>
  lookupOsuUser(username, { credentials: CREDENTIALS, ...(beforeCall ? { beforeCall } : {}) });

describe("lookupOsuUser", () => {
  it("finds a user by name, with our User-Agent and one cached token", async () => {
    const seen: { url: string; auth: string | null; agent: string | null }[] = [];
    server.use(
      http.get(USERS, ({ request }) => {
        seen.push({
          url: request.url,
          auth: request.headers.get("authorization"),
          agent: request.headers.get("user-agent"),
        });
        return HttpResponse.json({ id: 2, username: "peppy", avatar_url: "x" });
      }),
    );
    expect(await lookup("Peppy")).toEqual({ kind: "found", osuId: 2, username: "peppy" });
    await lookup("Mr Bot");
    expect(seen.map((call) => call.url)).toEqual([
      "https://osu.ppy.sh/api/v2/users/@Peppy",
      "https://osu.ppy.sh/api/v2/users/@Mr%20Bot",
    ]);
    expect(seen[0]).toMatchObject({ auth: "Bearer t1", agent: SERVER_USER_AGENT });
    expect(tokens).toBe(1);
  });

  it("reads a 404 as nobody by that name", async () => {
    server.use(http.get(USERS, () => HttpResponse.json({ error: null }, { status: 404 })));
    expect(await lookup("nobody")).toEqual({ kind: "missing" });
  });

  it("gets a fresh token once after a 401", async () => {
    server.use(
      http.get(USERS, ({ request }) =>
        request.headers.get("authorization") === "Bearer t1"
          ? HttpResponse.json({}, { status: 401 })
          : HttpResponse.json({ id: 3, username: "x" }),
      ),
    );
    expect(await lookup("x")).toEqual({ kind: "found", osuId: 3, username: "x" });
    expect(tokens).toBe(2);
  });

  it.each([
    ["the budget says no", () => HttpResponse.json({ id: 1, username: "a" }), false],
    ["osu! answers 503", () => HttpResponse.json({}, { status: 503 }), true],
    ["osu! can't be reached", () => HttpResponse.error(), true],
    ["the answer has no id", () => HttpResponse.json({ username: "a" }), true],
  ])("is unavailable when %s", async (_case, answer, allowed) => {
    server.use(http.get(USERS, answer));
    expect(await lookup("a", async () => allowed)).toEqual({ kind: "unavailable" });
  });
});
