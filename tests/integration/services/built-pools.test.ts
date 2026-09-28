/**
 * @file tests/integration/services/built-pools.test.ts
 * @desc The built pool services underneath the routes: a stored row that doesn't parse is left
 *       out (and logged); a user's pools, owned and edited, newest first; a pool's pack goes
 *       from packs only when it has one, and a packs that isn't set up or says no stops the
 *       change (502); going private removes the pack and resets its state, going nowhere new
 *       changes nothing; a first sign-in with a bad user shape links nothing.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

import { HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { linkNewEditor } from "@/lib/auth";
import { builtPoolsCollection } from "@/models/BuiltPool";
import {
  findBuiltPool,
  listBuiltPoolsFor,
  removePackOf,
  setBuiltPoolVisibility,
} from "@/services/built-pools";
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

const SYNCED = { state: "synced" as const, slug: "Abc123", syncedAt: new Date(), error: null };
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

describe("removePackOf", () => {
  it("does nothing for a pool without a pack", async () => {
    expect(await removePackOf(makeBuiltPool())).toEqual({ ok: true, value: null });
  });

  it("refuses when packs isn't set up here, or answers no", async () => {
    const pool = makeBuiltPool({ pack: SYNCED });
    expect(await removePackOf(pool)).toMatchObject({ ok: false, status: 502 });
    vi.stubEnv("POOLS_SERVICE_TOKEN", "short");
    expect(await removePackOf(pool)).toMatchObject({ ok: false, code: "pack_not_removed" });
    withPacks();
    server.use(packsDeleteHandler(() => HttpResponse.json({}, { status: 500 })));
    expect(await removePackOf(pool)).toMatchObject({ ok: false, status: 502 });
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
      value: { visibility: "private", version: 2, pack: { state: "none", slug: null } },
    });
    expect(calls.map((call) => call.id)).toEqual(["b-a0000001"]);
  });

  it("keeps the pool as it is when packs can't remove the pack", async () => {
    const cast = await createCast();
    await insertPool(cast, { _id: "b-a0000001", visibility: "public", pack: SYNCED });
    const answer = await setBuiltPoolVisibility(
      "b-a0000001",
      { ...cast.owner, isAdmin: false },
      "private",
    );
    expect(answer).toMatchObject({ ok: false, status: 502 });
    expect(await findBuiltPool("b-a0000001")).toMatchObject({ visibility: "public", version: 1 });
  });

  it("changes nothing when the visibility is the same", async () => {
    const cast = await createCast();
    await insertPool(cast, { _id: "b-a0000001" });
    const answer = await setBuiltPoolVisibility(
      "b-a0000001",
      { ...cast.owner, isAdmin: false },
      "private",
    );
    expect(answer).toMatchObject({ ok: true, value: { version: 1 } });
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
