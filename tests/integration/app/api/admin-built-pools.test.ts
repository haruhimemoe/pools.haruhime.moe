/**
 * @file tests/integration/app/api/admin-built-pools.test.ts
 * @desc Moderating built pools: only admins (everyone else gets 404, from this site only) hide,
 *       unhide and delete any built pool. Hiding a public pool sends its pack to packs as
 *       unlisted after the answer, unhiding sends it public again, and neither waits out the
 *       30 s between syncs; deleting removes the pack through the same path as the owner's
 *       delete (queued when packs doesn't answer).
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Mon Sep 28, 2026
 */

import { setupMsw } from "@haruhimemoe/next-kit/testing";
import { HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, PATCH } from "@/app/api/admin/built-pools/[id]/route";
import { builtPoolsCollection } from "@/models/BuiltPool";
import { findBuiltPool } from "@/services/built-pools";
import { packCleanupCollection } from "@/services/pack-cleanup";
import { EMPTY_BUILT_PACK } from "@/utils/built-pack";
import { runAfterTasks } from "../../../helpers/after";
import { ADMIN_OSU_ID } from "../../../helpers/auth";
import { setupTestDb } from "../../../helpers/db";
import {
  createdAnswer,
  type DeleteCall,
  type PutCall,
  packsDeleteHandler,
  packsPutHandler,
  TEST_SERVICE,
} from "../../../helpers/packs-server";
import { type Cast, createCast, insertPool, params } from "../../../helpers/pool-requests";

setupTestDb();
const server = setupMsw();
let cast: Cast;
let puts: PutCall[];
let deletes: DeleteCall[];
const ID = "b-a0000001";
const at = params({ id: ID });
const SLOTS = [{ mod: "NM", index: 1, beatmapId: 5 }];
const SYNCED = {
  ...EMPTY_BUILT_PACK,
  state: "synced" as const,
  slug: "Abc123",
  listed: true,
  // Inside the 30 s window a hide skips, and past the PUT timeout it doesn't.
  lastAttemptAt: new Date(Date.now() - 20_000),
};

beforeEach(async () => {
  vi.stubEnv("ADMIN_OSU_IDS", String(ADMIN_OSU_ID));
  vi.stubEnv("POOLS_SERVICE_TOKEN", TEST_SERVICE.token);
  vi.stubEnv("PACKS_URL", TEST_SERVICE.url);
  puts = [];
  deletes = [];
  server.use(packsPutHandler(createdAnswer, puts), packsDeleteHandler(undefined, deletes));
  cast = await createCast();
});
afterEach(() => {
  vi.stubEnv("POOLS_SERVICE_TOKEN", "");
  vi.stubEnv("PACKS_URL", "");
});

const request = (method: string, cookie: string | null, body?: unknown, origin?: string) =>
  new Request(`http://localhost:3000/api/admin/built-pools/${ID}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...(cookie ? { cookie } : {}),
      ...(origin ? { origin } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

describe("PATCH /api/admin/built-pools/<id>", () => {
  it("is 404 for everyone but an admin, and refuses other sites", async () => {
    await insertPool(cast, { _id: ID, visibility: "public", slots: SLOTS });
    for (const cookie of [null, cast.owner.cookie, cast.other.cookie]) {
      expect((await PATCH(request("PATCH", cookie, { hidden: true }), at)).status).toBe(404);
    }
    const crossSite = request("PATCH", cast.admin.cookie, { hidden: true }, "https://evil.test");
    expect((await PATCH(crossSite, at)).status).toBe(403);
    expect((await findBuiltPool(ID))?.hidden).toBe(false);
  });

  it("hides a public pool and sends its pack unlisted, then public again on unhide", async () => {
    await insertPool(cast, { _id: ID, visibility: "public", slots: SLOTS, pack: SYNCED });
    const hide = await PATCH(request("PATCH", cast.admin.cookie, { hidden: true }), at);
    expect(hide.status).toBe(200);
    expect(await hide.json()).toMatchObject({ pool: { id: ID, hidden: true, version: 2 } });
    await runAfterTasks();
    // Past the PUT timeout: the forced sync on unhide doesn't wait for the one on hide.
    const past = new Date(Date.now() - 20_000);
    await (await builtPoolsCollection()).updateOne(
      { _id: ID },
      { $set: { "pack.lastAttemptAt": past } },
    );
    const unhide = await PATCH(request("PATCH", cast.admin.cookie, { hidden: false }), at);
    expect(await unhide.json()).toMatchObject({ pool: { hidden: false, version: 3 } });
    await runAfterTasks();
    expect(puts.map((call) => call.body.visibility)).toEqual(["unlisted", "public"]);
    expect((await findBuiltPool(ID))?.pack.state).toBe("synced");
  });

  it("is 404 for a pool that isn't there", async () => {
    const response = await PATCH(request("PATCH", cast.admin.cookie, { hidden: true }), at);
    expect(response.status).toBe(404);
  });
});

describe("DELETE /api/admin/built-pools/<id>", () => {
  it("deletes any pool and its pack, queueing the removal when packs is down", async () => {
    await insertPool(cast, { _id: ID, slots: SLOTS, pack: SYNCED });
    expect((await DELETE(request("DELETE", cast.other.cookie), at)).status).toBe(404);
    expect((await DELETE(request("DELETE", cast.admin.cookie), at)).status).toBe(204);
    expect(deletes.map((call) => call.id)).toEqual([ID]);
    expect(await findBuiltPool(ID)).toBeNull();
    await insertPool(cast, { _id: "b-a0000002", visibility: "public", pack: SYNCED });
    server.use(packsDeleteHandler(() => HttpResponse.json({}, { status: 503 })));
    const other = new Request("http://localhost:3000/api/admin/built-pools/b-a0000002", {
      method: "DELETE",
      headers: { cookie: cast.admin.cookie },
    });
    const queued = await DELETE(other, params({ id: "b-a0000002" }));
    expect(queued.status).toBe(200);
    expect(await queued.json()).toMatchObject({ packRemoval: "queued" });
    expect(await (await packCleanupCollection()).countDocuments({ ref: "b-a0000002" })).toBe(1);
  });
});
