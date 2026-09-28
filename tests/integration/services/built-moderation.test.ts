/**
 * @file tests/integration/services/built-moderation.test.ts
 * @desc Admins' built pool list (newest first, every visibility, owner named, limited) and
 *       hiding: a new version each time it changes, nothing when it's already so, a public
 *       pool's pack marked pending, an unlisted one's left alone, null for no pool.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

import { describe, expect, it } from "vitest";
import { listRecentBuiltPools, setBuiltPoolHidden } from "@/services/built-moderation";
import { EMPTY_BUILT_PACK } from "@/utils/built-pack";
import { setupTestDb } from "../../helpers/db";
import { createCast, insertPool } from "../../helpers/pool-requests";

setupTestDb();

const made = (minutes: number) => new Date(Date.UTC(2026, 8, 27, 12, minutes));
const SLOTS = [{ mod: "NM", index: 1, beatmapId: 5 }];
const SYNCED = { ...EMPTY_BUILT_PACK, state: "synced" as const, slug: "Abc123" };

describe("listRecentBuiltPools", () => {
  it("lists the newest built pools of every visibility with their owner", async () => {
    const cast = await createCast();
    await insertPool(cast, { _id: "b-a0000001", createdAt: made(1), slots: SLOTS });
    await insertPool(cast, { _id: "b-a0000002", createdAt: made(2), visibility: "public" });
    await insertPool(cast, { _id: "b-a0000003", createdAt: made(3), hidden: true });
    const listed = await listRecentBuiltPools();
    expect(listed.map((pool) => pool.id)).toEqual(["b-a0000003", "b-a0000002", "b-a0000001"]);
    expect(listed[2]).toEqual({
      id: "b-a0000001",
      name: "Spring Cup Finals",
      owner: "owner",
      visibility: "private",
      hidden: false,
      maps: 1,
      pack: "none",
      createdAt: made(1),
    });
    expect(await listRecentBuiltPools(1)).toHaveLength(1);
  });
});

describe("setBuiltPoolHidden", () => {
  it("hides with a new version, marking a public pool's pack pending", async () => {
    const cast = await createCast();
    await insertPool(cast, { _id: "b-a0000001", visibility: "public", slots: SLOTS, pack: SYNCED });
    await insertPool(cast, {
      _id: "b-a0000002",
      visibility: "unlisted",
      slots: SLOTS,
      pack: SYNCED,
    });
    const hidden = await setBuiltPoolHidden("b-a0000001", true);
    expect(hidden).toMatchObject({ changed: true, pool: { hidden: true, version: 2 } });
    expect(hidden?.pool.pack.state).toBe("pending");
    const again = await setBuiltPoolHidden("b-a0000001", true);
    expect(again).toMatchObject({ changed: false, pool: { version: 2 } });
    const unlisted = await setBuiltPoolHidden("b-a0000002", true);
    expect(unlisted?.pool.pack.state).toBe("synced");
    expect(await setBuiltPoolHidden("b-zzzzzzzz", true)).toBeNull();
  });
});
