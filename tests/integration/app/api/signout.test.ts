/**
 * @file tests/integration/app/api/signout.test.ts
 * @desc POST /api/signout: another site is refused without asking the hub; otherwise only the
 *       session cookie goes to the hub's /api/auth/sign-out from pools' origin, and the answer
 *       clears the session cookies and the shared marker on .haruhime.moe (host-only on
 *       localhost), even when the hub fails.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Oct 6, 2026
 * @modified Tue Oct 6, 2026
 */

import { setupMsw } from "@haruhimemoe/next-kit/testing";
import { HttpResponse, http } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/signout/route";

const server = setupMsw();
afterEach(() => {
  vi.restoreAllMocks();
});

const SIGN_OUT = "https://www.haruhime.moe/api/auth/sign-out";

const request = (host: string, cookie: string, headers: Record<string, string> = {}) =>
  new Request(`https://${host}/api/signout`, { method: "POST", headers: { cookie, ...headers } });

/** Records what the hub got. */
const hub = (status = 200) => {
  const calls: { cookie: string | null; origin: string | null }[] = [];
  server.use(
    http.post(SIGN_OUT, ({ request: got }) => {
      calls.push({ cookie: got.headers.get("cookie"), origin: got.headers.get("origin") });
      return HttpResponse.json({ success: true }, { status });
    }),
  );
  return calls;
};

describe("POST /api/signout", () => {
  it("forwards only the session cookie, then clears the hub's cookies on .haruhime.moe", async () => {
    const calls = hub();
    const response = await POST(
      request("pools.haruhime.moe", "other=1; better-auth.session_token=t.s; haruhime-signed-in=1"),
    );
    expect(response.status).toBe(204);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(calls).toEqual([
      { cookie: "better-auth.session_token=t.s", origin: "https://pools.haruhime.moe" },
    ]);
    const cleared = response.headers.getSetCookie();
    expect(cleared).toHaveLength(5);
    expect(cleared.every((line) => line.includes("Domain=.haruhime.moe"))).toBe(true);
    expect(cleared.some((line) => line.startsWith("haruhime-signed-in=;"))).toBe(true);
  });

  it("clears the cookies even when the hub fails, and skips it without a session", async () => {
    const calls = hub(500);
    const failed = await POST(request("pools.haruhime.moe", "better-auth.session_token=t.s"));
    expect(failed.status).toBe(204);
    expect(failed.headers.getSetCookie()).toHaveLength(5);
    const none = await POST(request("localhost", "haruhime-signed-in=1"));
    expect(none.status).toBe(204);
    expect(calls).toHaveLength(1);
    expect(none.headers.getSetCookie().some((line) => line.includes("Domain"))).toBe(false);
  });

  it("refuses another site without asking the hub", async () => {
    const calls = hub();
    const response = await POST(
      request("pools.haruhime.moe", "better-auth.session_token=t.s", {
        origin: "https://evil.test",
      }),
    );
    expect(response.status).toBe(403);
    expect(response.headers.getSetCookie()).toEqual([]);
    expect(calls).toEqual([]);
  });
});
