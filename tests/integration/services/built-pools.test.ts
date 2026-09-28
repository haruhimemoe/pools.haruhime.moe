/**
 * @file tests/integration/services/built-pools.test.ts
 * @desc The built pool services underneath the routes: a stored row of the wrong shape is left
 *       out (and logged), one a newer content filter refuses still reads; a user's pools, owned
 *       and edited, newest first; deleting a pool or making it private removes its pack, and
 *       when packs isn't set up or says no the change still happens and the removal is queued;
 *       going nowhere new changes nothing; packs' 410 outlasts a trip to private and back; a first
 *       sign-in with a bad user shape links nothing.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Mon Sep 28, 2026
 */

import { HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { linkNewEditor } from "@/lib/auth";
import { builtPoolsCollection } from "@/models/BuiltPool";
import { applyBuiltPoolOps } from "@/services/built-pool-ops";
import {
  deleteBuiltPool,
  findBuiltPool,
  getBuiltPoolFor,
  listBuiltPoolsFor,
  setBuiltPoolVisibility,
} from "@/services/built-pools";
import { packCleanupCollection } from "@/services/pack-cleanup";
import { EMPTY_BUILT_PACK, PACK_GONE } from "@/utils/built-pack";
import { makeBuiltPool } from "../../helpers/built-pools";
import { setupTestDb } from "../../helpers/db";
import { setupMsw } from "../../helpers/msw";
import { type DeleteCall, packsDeleteHandler, TEST_SERVICE } from "../../helpers/packs-server";
import { createCast, insertPool } from "../../helpers/pool-requests";

setupTestDb();
const server = setupMsw();
afterEach(() => {
  vi.restoreAllMocks();
  vi.stubEnv("POOLS_SERVICE_TOKEN", "");
  vi.stubEnv("PACKS_URL", "");
});

const SYNCED = {
  state: "synced" as const,
  slug: "Abc123",
  syncedAt: new Date(),
  error: null,
  lastAttemptAt: null,
  listed: true,
  gone: false,
  retry: true,
};
const withPacks = () => {
  vi.stubEnv("POOLS_SERVICE_TOKEN", TEST_SERVICE.token);
  vi.stubEnv("PACKS_URL", TEST_SERVICE.url);
};

describe("findBuiltPool and listBuiltPoolsFor", () => {
  it("leaves out a row that doesn't parse, and a malformed id", async () => {
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    await (await builtPoolsCollection()).insertOne({ ...makeBuiltPool(), version: 0 });
    expect(await findBuiltPool("b-a0000001")).toBeNull();
    expect(quiet).toHaveBeenCalledOnce();
    expect(await findBuiltPool("otdb-1")).toBeNull();
  });

  it("reads a pool a newer content filter would refuse: listed, seen, fixed and deleted", async () => {
    const cast = await createCast();
    await insertPool(cast, { _id: "b-a0000001", name: "retard cup" });
    const owner = { ...cast.owner, avatarUrl: null, isAdmin: false };
    expect(await findBuiltPool("b-a0000001")).toMatchObject({ name: "retard cup" });
    expect((await listBuiltPoolsFor(owner)).owned.map((pool) => pool.id)).toEqual(["b-a0000001"]);
    expect(await getBuiltPoolFor("b-a0000001", owner)).toMatchObject({ ok: true });
    const add = { type: "addMap", beatmapId: 5, bucket: "NM" } as const;
    expect(await applyBuiltPoolOps("b-a0000001", owner, 1, [add])).toMatchObject({
      ok: false,
      status: 400,
      code: "content_filter",
    });
    const renamed = await applyBuiltPoolOps("b-a0000001", owner, 1, [
      { type: "setDetails", name: "Spring Cup" },
      add,
    ]);
    expect(renamed).toMatchObject({ ok: true, value: { name: "Spring Cup", version: 2 } });
    await (await builtPoolsCollection()).updateOne(
      { _id: "b-a0000001" },
      { $set: { name: "retard cup" } },
    );
    expect(await deleteBuiltPool("b-a0000001", owner)).toMatchObject({ ok: true });
    expect(await findBuiltPool("b-a0000001")).toBeNull();
  });

  it("lists the pools a user owns and edits, newest change first", async () => {
    const cast = await createCast();
    await insertPool(cast, { _id: "b-a0000001", updatedAt: new Date("2026-09-01") });
    await insertPool(cast, { _id: "b-a0000002", updatedAt: new Date("2026-09-20") });
    await insertPool(cast, { _id: "b-a0000003", ownerId: cast.other.id });
    const owner = await listBuiltPoolsFor(cast.owner);
    expect(owner.owned.map((pool) => pool.id)).toEqual(["b-a0000002", "b-a0000001"]);
    expect(owner.editing).toEqual([]);
    const editor = await listBuiltPoolsFor(cast.editor);
    expect(editor.editing.map((pool) => pool.id)).toHaveLength(3);
    expect(editor.owned[0]).toBeUndefined();
  });
});

describe("deleteBuiltPool", () => {
  it("deletes the pool even when packs can't remove its pack, queueing the removal", async () => {
    withPacks();
    server.use(packsDeleteHandler(() => HttpResponse.json({}, { status: 500 })));
    const cast = await createCast();
    await insertPool(cast, { _id: "b-a0000001", visibility: "public", pack: SYNCED });
    const answer = await deleteBuiltPool("b-a0000001", { ...cast.owner, isAdmin: false });
    expect(answer).toEqual({ ok: true, value: { packRemoval: "queued" } });
    expect(await findBuiltPool("b-a0000001")).toBeNull();
    expect(await (await packCleanupCollection()).findOne({ _id: "b-a0000001" })).toMatchObject({
      attempts: 1,
    });
  });

  it("says the pack went, or that there was none", async () => {
    withPacks();
    server.use(packsDeleteHandler());
    const cast = await createCast();
    await insertPool(cast, { _id: "b-a0000001", pack: SYNCED });
    await insertPool(cast, { _id: "b-a0000002" });
    const owner = { ...cast.owner, isAdmin: false };
    expect(await deleteBuiltPool("b-a0000001", owner)).toEqual({
      ok: true,
      value: { packRemoval: "removed" },
    });
    expect(await deleteBuiltPool("b-a0000002", owner)).toEqual({
      ok: true,
      value: { packRemoval: "none" },
    });
  });
});

describe("setBuiltPoolVisibility", () => {
  it("removes the pack when the pool goes private, and resets its state", async () => {
    withPacks();
    const calls: DeleteCall[] = [];
    server.use(packsDeleteHandler(undefined, calls));
    const cast = await createCast();
    await insertPool(cast, { _id: "b-a0000001", visibility: "public", pack: SYNCED });
    const answer = await setBuiltPoolVisibility(
      "b-a0000001",
      { ...cast.owner, isAdmin: false },
      "private",
    );
    expect(answer).toMatchObject({
      ok: true,
      value: {
        pool: { visibility: "private", version: 2, pack: { state: "none", href: null } },
        packRemoval: "removed",
      },
    });
    expect(calls.map((call) => call.id)).toEqual(["b-a0000001"]);
    expect((await findBuiltPool("b-a0000001"))?.pack).toEqual(EMPTY_BUILT_PACK);
  });

  it("keeps packs' 410 when the pool goes private and back: it's never synced again", async () => {
    withPacks();
    server.use(packsDeleteHandler(() => new HttpResponse(null, { status: 410 })));
    const cast = await createCast();
    const slots = [{ mod: "NM", index: 1, beatmapId: 5 }];
    const pack = { ...SYNCED, state: "failed" as const, error: PACK_GONE, gone: true };
    await insertPool(cast, { _id: "b-a0000001", visibility: "public", slots, pack });
    const owner = { ...cast.owner, isAdmin: false };
    const gone = { state: "none", href: null, gone: true };
    const away = await setBuiltPoolVisibility("b-a0000001", owner, "private");
    expect(away).toMatchObject({ ok: true, value: { pool: { pack: gone } } });
    const back = await setBuiltPoolVisibility("b-a0000001", owner, "unlisted");
    expect(back).toMatchObject({ ok: true, value: { pool: { pack: gone } } });
    expect((await findBuiltPool("b-a0000001"))?.pack).toEqual({ ...EMPTY_BUILT_PACK, gone: true });
  });

  it("marks the pack pending when a pool with maps goes unlisted or public", async () => {
    const cast = await createCast();
    const slots = [{ mod: "NM", index: 1, beatmapId: 5 }];
    await insertPool(cast, { _id: "b-a0000001", slots });
    await insertPool(cast, { _id: "b-a0000002" });
    const owner = { ...cast.owner, isAdmin: false };
    const shared = await setBuiltPoolVisibility("b-a0000001", owner, "unlisted");
    expect(shared).toMatchObject({ ok: true, value: { pool: { pack: { state: "pending" } } } });
    const empty = await setBuiltPoolVisibility("b-a0000002", owner, "public");
    expect(empty).toMatchObject({ ok: true, value: { pool: { pack: { state: "none" } } } });
  });

  it("goes private even when packs isn't there to remove the pack, queueing the removal", async () => {
    const cast = await createCast();
    await insertPool(cast, { _id: "b-a0000001", visibility: "public", pack: SYNCED });
    const answer = await setBuiltPoolVisibility(
      "b-a0000001",
      { ...cast.owner, isAdmin: false },
      "private",
    );
    expect(answer).toMatchObject({
      ok: true,
      value: { pool: { visibility: "private", version: 2 }, packRemoval: "queued" },
    });
    expect(await findBuiltPool("b-a0000001")).toMatchObject({
      visibility: "private",
      pack: { state: "none" },
    });
    expect(await (await packCleanupCollection()).findOne({ _id: "b-a0000001" })).toMatchObject({
      reason: "packs isn't set up here.",
    });
  });

  it("changes nothing when the visibility is the same", async () => {
    const cast = await createCast();
    await insertPool(cast, { _id: "b-a0000001" });
    const answer = await setBuiltPoolVisibility(
      "b-a0000001",
      { ...cast.owner, isAdmin: false },
      "private",
    );
    expect(answer).toMatchObject({
      ok: true,
      value: { pool: { version: 1 }, packRemoval: "none" },
    });
  });
});

describe("linkNewEditor", () => {
  it("links nothing for a user without an osu! id", async () => {
    const cast = await createCast();
    await insertPool(cast, { _id: "b-a0000001" });
    await linkNewEditor({ id: "x" });
    expect((await findBuiltPool("b-a0000001"))?.editors[0]?.userId).toBe(cast.editor.id);
  });
});
