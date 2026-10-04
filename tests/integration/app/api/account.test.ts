/**
 * @file tests/integration/app/api/account.test.ts
 * @desc DELETE /api/account: a visitor gets 401; a request from another site is refused; the body
 *       must be JSON, strict, and name the caller's own osu! username (the typed confirmation);
 *       then the user, every session and every linked account are gone, other people's rows
 *       stay, the API key and the user's API counters go, the old cookie reads as signed out, and the answer clears the signed-in marker.
 *       The cascade: every pool they own goes (its pack on packs deleted), and they're taken off
 *       every pool they edit; when packs can't remove a pack, the account and pools go anyway,
 *       the removals are queued (packs asked once, the rest queued without asking) and the
 *       answer says how many. At most 3 deletions an hour per osu! account, and the per-account limits
 *       are kept by osu! id, so deleting the account doesn't reset them.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sat Oct 3, 2026
 */

import { setupMsw } from "@haruhimemoe/next-kit/testing";
import { ObjectId } from "mongodb";
import { HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DELETE } from "@/app/api/account/route";
import { POST as createPool } from "@/app/api/pools/route";
import { RATE_LIMITS } from "@/constants/api";
import { apiKeys } from "@/lib/api-keys";
import { getUserFromHeaders } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { limiter } from "@/lib/rate-limit";
import { builtPoolsCollection } from "@/models/BuiltPool";
import { packCleanupCollection } from "@/services/pack-cleanup";
import { createTestUser } from "../../../helpers/auth";
import { setupTestDb } from "../../../helpers/db";
import { type DeleteCall, packsDeleteHandler, TEST_SERVICE } from "../../../helpers/packs-server";
import { createCast, insertPool, poolRequest } from "../../../helpers/pool-requests";

setupTestDb();
const server = setupMsw();
afterEach(() => {
  vi.useRealTimers();
});

/** Early in an hour, so a fixed window can't roll over mid-test. */
const earlyInTheHour = () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(`${new Date().toISOString().slice(0, 13)}:00:01.000Z`));
};

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

  it("deletes the API key and the user's API counters, and nobody else's", async () => {
    const user = await createTestUser(2, "peppy");
    const other = await createTestUser(3, "other");
    const gone = await apiKeys.issue(user.id);
    const kept = await apiKeys.issue(other.id);
    await limiter.hit(RATE_LIMITS.api, user.id);
    await limiter.hit(RATE_LIMITS.keyCreate, user.id);
    await limiter.hit(RATE_LIMITS.api, other.id);
    expect((await DELETE(request(user.cookie, { username: "peppy" }))).status).toBe(204);
    expect(await apiKeys.authenticate(gone.key)).toBeNull();
    expect((await apiKeys.authenticate(kept.key))?.userId).toBe(other.id);
    const counters = await getDb()
      .collection<{ _id: string }>("rate_limits")
      .find({ _id: { $regex: /^(api|key-create):/ } })
      .toArray();
    expect(counters.map((doc) => doc._id.split(":")[1])).toEqual([other.id]);
  });
});

describe("DELETE /api/account limits", () => {
  it("allows 3 deletions an hour per osu! account", async () => {
    earlyInTheHour();
    for (let i = 0; i < 3; i++) {
      const user = await createTestUser(2, "peppy");
      expect((await DELETE(request(user.cookie, { username: "peppy" }))).status).toBe(204);
    }
    const user = await createTestUser(2, "peppy");
    const over = await DELETE(request(user.cookie, { username: "peppy" }));
    expect(over.status).toBe(429);
    expect(over.headers.get("cache-control")).toBe("no-store");
    expect(await rowsOf(user.id)).toEqual({ users: 1, sessions: 1, accounts: 1 });
    const other = await createTestUser(3, "other");
    expect((await DELETE(request(other.cookie, { username: "other" }))).status).toBe(204);
  });

  it("keeps the per-account limits when the account is deleted and made again", async () => {
    earlyInTheHour();
    const first = await createTestUser(2, "peppy");
    const make = (cookie: string, name: string) =>
      createPool(poolRequest("POST", "/api/pools", cookie, { name }));
    for (let i = 0; i < 10; i++) expect((await make(first.cookie, `Cup ${i}`)).status).toBe(201);
    expect((await DELETE(request(first.cookie, { username: "peppy" }))).status).toBe(204);
    const again = await createTestUser(2, "peppy");
    expect((await make(again.cookie, "Cup 11")).status).toBe(429);
  });
});

describe("DELETE /api/account and pools", () => {
  const synced = {
    state: "synced" as const,
    slug: "Abc123",
    syncedAt: new Date(),
    error: null,
    lastAttemptAt: null,
    listed: true,
    gone: false,
    retry: true,
  };

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

  it("deletes everything anyway when packs is down, queues the removals and says so", async () => {
    const cast = await setup();
    await insertPool(cast, { _id: "b-a0000004", visibility: "unlisted", pack: synced });
    const calls: DeleteCall[] = [];
    server.use(packsDeleteHandler(() => HttpResponse.json({}, { status: 503 }), calls));
    const response = await DELETE(request(cast.owner.cookie, { username: "owner" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      packRemovalsQueued: 2,
      notice:
        "packs.haruhime.moe didn't answer, so 2 packs will be removed there as soon as it does.",
    });
    expect(response.headers.getSetCookie().join("\n")).toMatch(/pools-signed-in=;.*Max-Age=0/);
    expect(calls).toHaveLength(1);
    expect(await rowsOf(cast.owner.id)).toEqual({ users: 0, sessions: 0, accounts: 0 });
    expect(await (await builtPoolsCollection()).countDocuments({ ownerId: cast.owner.id })).toBe(0);
    const queued = await (await packCleanupCollection()).find().sort({ _id: 1 }).toArray();
    expect(queued.map((entry) => entry.ref)).toEqual(["b-a0000001", "b-a0000004"]);
  });
});
