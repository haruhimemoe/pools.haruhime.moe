/**
 * @file tests/integration/services/built-pool-owner.test.ts
 * @desc Handing a pool over while other writes land, stepped by hand between the service's own
 *       reads: a 409 goes to an old owner who can still see the pool, and a 404 to one who
 *       can't; a handover over the cap is given back even when an op landed before the give
 *       back (the op's change kept), and one that can't be given back any more is reported as
 *       it stands.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { Collection } from "mongodb";
import { afterEach, describe, expect, it, vi } from "vitest";
import { builtPoolsCollection } from "@/models/BuiltPool";
import { transferBuiltPool } from "@/services/built-pool-owner";
import { findBuiltPool } from "@/services/built-pool-read";
import { makeBuiltPool } from "../../helpers/built-pools";
import { setupTestDb } from "../../helpers/db";
import { type Cast, createCast, EDITOR_OSU_ID, insertPool } from "../../helpers/pool-requests";

setupTestDb();
afterEach(() => {
  vi.restoreAllMocks();
});

const ID = "b-a0000001";
const NAME = "Spring Cup Finals";

/** Runs `between[n]` just after the service's n-th count of the editor's pools. */
const afterCounts = (between: (() => Promise<unknown>)[]) => {
  const count = Collection.prototype.countDocuments;
  let calls = 0;
  vi.spyOn(Collection.prototype, "countDocuments").mockImplementation(async function (
    this: Collection,
    ...args: Parameters<Collection["countDocuments"]>
  ) {
    const counted = await count.apply(this, args);
    await between[calls++]?.();
    return counted;
  });
};

const handOver = (cast: Cast) =>
  transferBuiltPool(ID, { ...cast.owner, avatarUrl: null, isAdmin: false }, EDITOR_OSU_ID, NAME);

/** The editor owns `count` pools besides this one. */
const editorOwns = async (cast: Cast, count: number, from = 0) =>
  (await builtPoolsCollection()).insertMany(
    Array.from({ length: count }, (_, i) =>
      makeBuiltPool({ _id: `b-e${String(from + i).padStart(7, "0")}`, ownerId: cast.editor.id }),
    ),
  );

describe("transferBuiltPool: a change in between", () => {
  it("gives a 404, not the pool, to an old owner who can't see it any more", async () => {
    const cast = await createCast();
    await insertPool(cast, { _id: ID });
    // Another tab handed it to the editor, who then took the old owner off.
    afterCounts([
      async () =>
        (await builtPoolsCollection()).updateOne(
          { _id: ID },
          { $set: { ownerId: cast.editor.id, editors: [] }, $inc: { version: 2 } },
        ),
    ]);
    expect(await handOver(cast)).toMatchObject({ ok: false, status: 404 });
  });

  it("gives the pool back when a create went over the cap, keeping an op that landed", async () => {
    const cast = await createCast();
    await insertPool(cast, { _id: ID });
    await editorOwns(cast, 49);
    const pools = await builtPoolsCollection();
    afterCounts([
      () => editorOwns(cast, 1, 49),
      () => pools.updateOne({ _id: ID }, { $set: { notes: "Kept." }, $inc: { version: 1 } }),
    ]);
    expect(await handOver(cast)).toMatchObject({ ok: false, code: "too_many_pools" });
    const back = await findBuiltPool(ID);
    expect(back).toMatchObject({ ownerId: cast.owner.id, notes: "Kept.", version: 4 });
    expect(back?.editors.map((editor) => editor.osuId)).toEqual([EDITOR_OSU_ID]);
  });

  it("says the pool was handed over when it can't be given back any more", async () => {
    const cast = await createCast();
    await insertPool(cast, { _id: ID });
    await editorOwns(cast, 49);
    const pools = await builtPoolsCollection();
    // The new owner handed it on (to someone else) before the give back.
    afterCounts([
      () => editorOwns(cast, 1, 49),
      () =>
        pools.updateOne({ _id: ID }, { $set: { ownerId: cast.other.id }, $inc: { version: 1 } }),
    ]);
    const answer = await handOver(cast);
    expect(answer).toMatchObject({ ok: true, value: { access: { isOwner: false } } });
    expect((await findBuiltPool(ID))?.ownerId).toBe(cast.other.id);
  });
});
