/**
 * @file tests/integration/services/account.test.ts
 * @desc Taking a leaving user out of built pools while a handover lands: a pool handed to them
 *       after their owned pools were read is deleted too, so no pool is left owned by a deleted
 *       account.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { Collection } from "mongodb";
import { afterEach, describe, expect, it, vi } from "vitest";
import { builtPoolsCollection } from "@/models/BuiltPool";
import { removeUserFromBuiltPools } from "@/services/account";
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
});
