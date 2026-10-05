/**
 * @file tests/integration/services/account.test.ts
 * @desc Taking a leaving user out of built pools while a handover lands: a pool handed to them
 *       after their owned pools were read is deleted too, so no pool is left owned by a deleted
 *       account; their votes and "added by" leave the candidates of pools they edited; an owned
 *       pool's history goes with it, and their saves on pools they only edit are renamed
 *       "deleted user".
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Oct 5, 2026
 */

import { Collection } from "mongodb";
import { afterEach, describe, expect, it, vi } from "vitest";
import { poolRevisions } from "@/lib/pool-revisions";
import { builtPoolsCollection } from "@/models/BuiltPool";
import { removeUserFromBuiltPools } from "@/services/account";
import { ensureHistory } from "@/services/built-pool-history";
import { applyBuiltPoolOps } from "@/services/built-pool-ops";
import { findBuiltPool } from "@/services/built-pool-read";
import { candidate } from "../../helpers/candidates";
import { setupTestDb } from "../../helpers/db";
import { createCast, EDITOR_OSU_ID, insertPool } from "../../helpers/pool-requests";

setupTestDb();
afterEach(() => {
  vi.restoreAllMocks();
});

describe("removeUserFromBuiltPools", () => {
  it("deletes a pool handed to the user after their pools were read", async () => {
    const cast = await createCast();
    const leaving = { id: cast.editor.id, osuId: EDITOR_OSU_ID };
    await insertPool(cast, { _id: "b-a0000001" });
    const pools = await builtPoolsCollection();
    // The owner hands the pool to the leaving editor between the read and the editors' $pull.
    const updateMany = Collection.prototype.updateMany;
    let landed = false;
    vi.spyOn(Collection.prototype, "updateMany").mockImplementation(async function (
      this: Collection,
      ...args: Parameters<Collection["updateMany"]>
    ) {
      if (!landed) {
        landed = true;
        await pools.updateOne(
          { _id: "b-a0000001" },
          { $set: { ownerId: leaving.id, editors: [] }, $inc: { version: 1 } },
        );
      }
      return updateMany.apply(this, args);
    });
    await removeUserFromBuiltPools(leaving);
    expect(await pools.countDocuments({ ownerId: leaving.id })).toBe(0);
    expect(await pools.countDocuments({ "editors.osuId": EDITOR_OSU_ID })).toBe(0);
  });

  it("takes their votes and name off the candidates of pools they edited", async () => {
    const cast = await createCast();
    const candidates = {
      "NM:1": [candidate(5, { addedBy: EDITOR_OSU_ID, votes: [10, EDITOR_OSU_ID] })],
    };
    await insertPool(cast, { _id: "b-a0000001", candidates });
    await removeUserFromBuiltPools({ id: cast.editor.id, osuId: EDITOR_OSU_ID });
    expect((await findBuiltPool("b-a0000001"))?.candidates?.["NM:1"]?.[0]).toMatchObject({
      addedBy: 0,
      votes: [10],
    });
  });

  it("deletes an owned pool's history, and renames the leaving user's saves on pools they edit", async () => {
    const cast = await createCast();
    await insertPool(cast, { _id: "b-a0000001" });
    const owned = await findBuiltPool("b-a0000001");
    if (!owned) throw new Error("expected the pool");
    const ownedRoot = await ensureHistory(owned);

    await insertPool(cast, { _id: "b-a0000002", ownerId: cast.other.id });
    const edited = await findBuiltPool("b-a0000002");
    if (!edited) throw new Error("expected the pool");
    await ensureHistory(edited);
    await applyBuiltPoolOps(
      "b-a0000002",
      { ...cast.editor, avatarUrl: null, isAdmin: false },
      { baseVersion: 1 },
      [{ type: "addMap", beatmapId: 1, bucket: "NM" }],
    );

    await removeUserFromBuiltPools({ id: cast.owner.id, osuId: 10 });
    expect(await poolRevisions.get("b-a0000001", ownedRoot.id)).toBeNull();

    await removeUserFromBuiltPools({ id: cast.editor.id, osuId: EDITOR_OSU_ID });
    const revisions = await poolRevisions.list("b-a0000002");
    expect(revisions.some((revision) => revision.authorName === "deleted user")).toBe(true);
  });
});
