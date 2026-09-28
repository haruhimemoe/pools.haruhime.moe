/**
 * @file tests/integration/app/api/pool-pack.test.ts
 * @desc A built pool's pack through the routes, packs stood in by msw: a change to a public pool
 *       marks its pack pending and syncs it after the answer; a private pool's change schedules
 *       a sync that sends nothing; going private then deletes the pack; the editor's poll syncs
 *       a change that waited; adding or removing an editor sends the new names. "Update pack
 *       now" syncs at once for the owner and editors (once no sync is still out), and is
 *       refused for private, empty and removed pools, for others (403, or 404 when they can't
 *       see it) and when signed out.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Mon Sep 28, 2026
 */

import { revalidatePath } from "next/cache";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE as deleteEditor } from "@/app/api/pools/[id]/editors/[osuId]/route";
import { POST as postEditor } from "@/app/api/pools/[id]/editors/route";
import { POST as postOps } from "@/app/api/pools/[id]/ops/route";
import { POST as postPack } from "@/app/api/pools/[id]/pack/route";
import { GET } from "@/app/api/pools/[id]/route";
import { PUT } from "@/app/api/pools/[id]/visibility/route";
import { builtPoolsCollection } from "@/models/BuiltPool";
import { findBuiltPool } from "@/services/built-pools";
import { EMPTY_BUILT_PACK, PACK_GONE } from "@/utils/built-pack";
import { afterTaskCount, runAfterTasks } from "../../../helpers/after";
import { setupTestDb } from "../../../helpers/db";
import { setupMsw } from "../../../helpers/msw";
import {
  createdAnswer,
  type DeleteCall,
  type PutCall,
  packsDeleteHandler,
  packsPutHandler,
  slugFor,
  TEST_SERVICE,
} from "../../../helpers/packs-server";
import {
  type Cast,
  createCast,
  insertPool,
  osuUserHandlers,
  params,
  poolRequest,
} from "../../../helpers/pool-requests";

setupTestDb();
const server = setupMsw();
let cast: Cast;
let puts: PutCall[];
let deletes: DeleteCall[];
const ID = "b-a0000001";
const at = params({ id: ID });
const SLOTS = [{ mod: "NM", index: 1, beatmapId: 5 }];

beforeEach(async () => {
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

const rename = (cookie: string, baseVersion: number, name: string) =>
  postOps(
    poolRequest("POST", `/api/pools/${ID}/ops`, cookie, {
      baseVersion,
      ops: [{ type: "setDetails", name }],
    }),
    at,
  );

describe("a change to a shared pool", () => {
  it("marks the pack pending, syncs it after the answer, and going private deletes it", async () => {
    await insertPool(cast, { _id: ID, visibility: "public", slots: SLOTS });
    const response = await rename(cast.editor.cookie, 1, "Renamed");
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ pool: { pack: { state: "pending" } } });
    await runAfterTasks();
    expect(puts.map((call) => call.body.name)).toEqual(["Renamed"]);
    expect((await findBuiltPool(ID))?.pack).toMatchObject({ state: "synced", slug: slugFor(ID) });
    const privately = poolRequest("PUT", `/api/pools/${ID}/visibility`, cast.owner.cookie, {
      visibility: "private",
    });
    expect((await PUT(privately, at)).status).toBe(200);
    expect(deletes.map((call) => call.id)).toEqual([ID]);
    // It leaves the home page, the sitemap and llms.txt.
    expect(vi.mocked(revalidatePath).mock.calls.map(([path]) => path)).toEqual(
      expect.arrayContaining(["/", "/sitemap.xml", "/llms.txt"]),
    );
    expect(afterTaskCount()).toBe(0);
  });

  it("sends nothing for a private pool", async () => {
    await insertPool(cast, { _id: ID, slots: SLOTS });
    await rename(cast.owner.cookie, 1, "Renamed");
    await runAfterTasks();
    expect(puts).toEqual([]);
    expect((await findBuiltPool(ID))?.pack.state).toBe("none");
  });

  it("syncs a change that waited out the window when the editor next asks", async () => {
    const tried = { ...EMPTY_BUILT_PACK, state: "synced" as const, lastAttemptAt: new Date() };
    await insertPool(cast, { _id: ID, visibility: "unlisted", slots: SLOTS, pack: tried });
    await rename(cast.owner.cookie, 1, "Renamed");
    await runAfterTasks();
    expect(puts).toEqual([]);
    const old = new Date(Date.now() - 60_000);
    await (await builtPoolsCollection()).updateOne(
      { _id: ID },
      { $set: { "pack.lastAttemptAt": old } },
    );
    const read = await GET(poolRequest("GET", `/api/pools/${ID}`, cast.owner.cookie), at);
    expect(read.status).toBe(200);
    await runAfterTasks();
    expect(puts.map((call) => call.body.visibility)).toEqual(["unlisted"]);
  });
});

describe("packs' reason for a failed sync", () => {
  it("goes to the owner and editors only", async () => {
    const failed = { ...EMPTY_BUILT_PACK, state: "failed" as const, error: "packs answered 503." };
    await insertPool(cast, { _id: ID, visibility: "public", slots: SLOTS, pack: failed });
    const packOf = async (cookie: string | null) =>
      (
        (await (await GET(poolRequest("GET", `/api/pools/${ID}`, cookie), at)).json()) as {
          pool: { pack: { state: string; error: string | null } };
        }
      ).pool.pack;
    expect(await packOf(cast.editor.cookie)).toEqual(
      expect.objectContaining({ state: "failed", error: "packs answered 503." }),
    );
    expect(await packOf(cast.other.cookie)).toEqual(
      expect.objectContaining({ state: "failed", error: null }),
    );
    expect(await packOf(null)).toEqual(expect.objectContaining({ error: null }));
  });
});

describe("a change to who edits a shared pool", () => {
  it("syncs the pack with the names in its description", async () => {
    await insertPool(cast, { _id: ID, visibility: "public", slots: SLOTS });
    server.use(...osuUserHandlers({ newbie: 30 }));
    const add = poolRequest("POST", `/api/pools/${ID}/editors`, cast.owner.cookie, {
      username: "newbie",
    });
    expect((await postEditor(add, at)).status).toBe(200);
    await runAfterTasks();
    const remove = poolRequest("DELETE", `/api/pools/${ID}/editors/20`, cast.owner.cookie);
    await (await builtPoolsCollection()).updateOne(
      { _id: ID },
      { $set: { "pack.lastAttemptAt": new Date(Date.now() - 60_000) } },
    );
    expect((await deleteEditor(remove, params({ id: ID, osuId: "20" }))).status).toBe(204);
    await runAfterTasks();
    expect(puts.map((call) => call.body.description.split(":")[0])).toEqual([
      "Built on pools.haruhime.moe by owner, editor and newbie",
      "Built on pools.haruhime.moe by owner and newbie",
    ]);
  });
});

describe("POST /api/pools/<id>/pack (Update pack now)", () => {
  const updateNow = (cookie: string | null) =>
    postPack(poolRequest("POST", `/api/pools/${ID}/pack`, cookie), at);
  // Tried 20 s ago: inside the 30 s window, and past the PUT timeout.
  const tried = () => new Date(Date.now() - 20_000);
  const recent = { ...EMPTY_BUILT_PACK, state: "pending" as const, lastAttemptAt: tried() };

  it("syncs at once for the owner and editors, inside the 30 s window", async () => {
    await insertPool(cast, { _id: ID, visibility: "public", slots: SLOTS, pack: recent });
    const pools = await builtPoolsCollection();
    for (const user of [cast.owner, cast.editor]) {
      await pools.updateOne({ _id: ID }, { $set: { "pack.lastAttemptAt": tried() } });
      const response = await updateNow(user.cookie);
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({
        pool: { pack: { state: "synced", href: `https://packs.haruhime.moe/p/${slugFor(ID)}` } },
      });
    }
    expect(puts).toHaveLength(2);
  });

  it("is refused for private, empty and removed pools", async () => {
    await insertPool(cast, { _id: ID, slots: SLOTS });
    await insertPool(cast, { _id: "b-a0000002", visibility: "public" });
    const gone = { ...EMPTY_BUILT_PACK, state: "failed" as const, error: PACK_GONE, gone: true };
    await insertPool(cast, { _id: "b-a0000003", visibility: "public", slots: SLOTS, pack: gone });
    const codes: unknown[] = [];
    for (const id of [ID, "b-a0000002", "b-a0000003"]) {
      const request = poolRequest("POST", `/api/pools/${id}/pack`, cast.owner.cookie);
      const response = await postPack(request, params({ id }));
      expect(response.status).toBe(400);
      codes.push(((await response.json()) as { error: { code: string } }).error.code);
    }
    expect(codes).toEqual(["private", "empty", "pack_gone"]);
    expect(puts).toEqual([]);
  });

  it("is 403 for others who see it, 404 for those who don't, 401 signed out", async () => {
    await insertPool(cast, { _id: ID, visibility: "public", slots: SLOTS, pack: recent });
    expect((await updateNow(cast.other.cookie)).status).toBe(403);
    expect((await updateNow(cast.admin.cookie)).status).toBe(403);
    expect((await updateNow(null)).status).toBe(401);
    await insertPool(cast, { _id: "b-a0000002", slots: SLOTS });
    const hidden = poolRequest("POST", "/api/pools/b-a0000002/pack", cast.other.cookie);
    expect((await postPack(hidden, params({ id: "b-a0000002" }))).status).toBe(404);
    expect(puts).toEqual([]);
  });
});
