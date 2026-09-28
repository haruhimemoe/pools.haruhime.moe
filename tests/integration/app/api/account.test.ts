/**
 * @file tests/integration/app/api/account.test.ts
 * @desc DELETE /api/account: a visitor gets 401; a request from another site is refused; the body
 *       must be JSON, strict, and name the caller's own osu! username (the typed confirmation);
 *       then the user, every session and every linked account are gone, other people's rows
 *       stay, the old cookie reads as signed out, and the answer clears the signed-in marker.
 *       The cascade: every pool they own goes (its pack on packs deleted first), and they're
 *       taken off every pool they edit; when packs can't remove a pack, the account stays and
 *       the answer is 502.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

import { ObjectId } from "mongodb";
import { HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { DELETE } from "@/app/api/account/route";
import { getUserFromHeaders } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { builtPoolsCollection } from "@/models/BuiltPool";
import { createTestUser } from "../../../helpers/auth";
import { setupTestDb } from "../../../helpers/db";
import { setupMsw } from "../../../helpers/msw";
import { type DeleteCall, packsDeleteHandler, TEST_SERVICE } from "../../../helpers/packs-server";
import { createCast, insertPool } from "../../../helpers/pool-requests";

setupTestDb();
const server = setupMsw();

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

describe("DELETE /api/account and pools", () => {
  const synced = { state: "synced" as const, slug: "Abc123", syncedAt: new Date(), error: null };

  const setup = async () => {
    vi.stubEnv("POOLS_SERVICE_TOKEN", TEST_SERVICE.token);
    vi.stubEnv("PACKS_URL", TEST_SERVICE.url);
    const cast = await createCast();
    await insertPool(cast, { _id: "b-a0000001", visibility: "public", pack: synced });
    await insertPool(cast, { _id: "b-a0000002" });
    const editorOf = { userId: cast.owner.id, osuId: 10, username: "owner", addedAt: new Date() };
    await insertPool(cast, { _id: "b-a0000003", ownerId: cast.other.id, editors: [editorOf] });
    return cast;
  };

  it("deletes their pools (the pack on packs first) and takes them off pools they edit", async () => {
    const cast = await setup();
    const calls: DeleteCall[] = [];
    server.use(packsDeleteHandler(undefined, calls));
    const response = await DELETE(request(cast.owner.cookie, { username: "owner" }));
    expect(response.status).toBe(204);
    expect(calls.map((call) => call.id)).toEqual(["b-a0000001"]);
    const pools = await builtPoolsCollection();
    expect(await pools.countDocuments({ ownerId: cast.owner.id })).toBe(0);
    expect(await pools.findOne({ _id: "b-a0000003" })).toMatchObject({ editors: [], version: 2 });
    expect(await rowsOf(cast.owner.id)).toEqual({ users: 0, sessions: 0, accounts: 0 });
  });

  it("keeps the account, and says so, when packs can't remove a pack", async () => {
    const cast = await setup();
    server.use(packsDeleteHandler(() => HttpResponse.json({}, { status: 503 })));
    const response = await DELETE(request(cast.owner.cookie, { username: "owner" }));
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ error: { code: "pack_not_removed" } });
    expect(await rowsOf(cast.owner.id)).toEqual({ users: 1, sessions: 1, accounts: 1 });
    expect(await (await builtPoolsCollection()).countDocuments({ _id: "b-a0000001" })).toBe(1);
  });
});
