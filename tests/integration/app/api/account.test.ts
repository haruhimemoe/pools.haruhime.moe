/**
 * @file tests/integration/app/api/account.test.ts
 * @desc DELETE /api/account: a visitor gets 401; a request from another site is refused; the body
 *       must be JSON, strict, and name the caller's own osu! username (the typed confirmation);
 *       then the user, every session and every linked account are gone, other people's rows
 *       stay, the old cookie reads as signed out, and the answer clears the signed-in marker.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

import { ObjectId } from "mongodb";
import { describe, expect, it } from "vitest";
import { DELETE } from "@/app/api/account/route";
import { getUserFromHeaders } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { createTestUser } from "../../../helpers/auth";
import { setupTestDb } from "../../../helpers/db";

setupTestDb();

const request = (cookie: string | null, body: unknown, headers: Record<string, string> = {}) =>
  new Request("http://localhost:3000/api/account", {
    method: "DELETE",
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}), ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

const rowsOf = async (userId: string) => {
  const db = getDb();
  const id = new ObjectId(userId);
  return {
    users: await db.collection("user").countDocuments({ _id: id }),
    sessions: await db.collection("session").countDocuments({ userId: id }),
    accounts: await db.collection("account").countDocuments({ userId: id }),
  };
};

describe("DELETE /api/account", () => {
  it("wants a signed-in caller, from this site", async () => {
    expect((await DELETE(request(null, { username: "x" }))).status).toBe(401);
    const user = await createTestUser(2, "peppy");
    const crossSite = request(user.cookie, { username: "peppy" }, { origin: "https://evil.test" });
    expect((await DELETE(crossSite)).status).toBe(403);
    expect(await rowsOf(user.id)).toEqual({ users: 1, sessions: 1, accounts: 1 });
  });

  it.each([
    ["not JSON", "username=peppy", 400],
    ["another name", { username: "someone" }, 400],
    ["the name in another case", { username: "PEPPY" }, 400],
    ["an extra key", { username: "peppy", also: 1 }, 400],
  ])("refuses %s and deletes nothing", async (_case, body, status) => {
    const user = await createTestUser(2, "peppy");
    expect((await DELETE(request(user.cookie, body))).status).toBe(status);
    expect(await rowsOf(user.id)).toEqual({ users: 1, sessions: 1, accounts: 1 });
  });

  it("deletes the user, their sessions and accounts, and nobody else's", async () => {
    const user = await createTestUser(2, "peppy");
    const other = await createTestUser(3, "other");
    const response = await DELETE(request(user.cookie, { username: " peppy " }));
    expect(response.status).toBe(204);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.getSetCookie().join("\n")).toMatch(/pools-signed-in=;.*Max-Age=0/);
    expect(await rowsOf(user.id)).toEqual({ users: 0, sessions: 0, accounts: 0 });
    expect(await rowsOf(other.id)).toEqual({ users: 1, sessions: 1, accounts: 1 });
    expect(await getUserFromHeaders(new Headers({ cookie: user.cookie }))).toBeNull();
  });
});
