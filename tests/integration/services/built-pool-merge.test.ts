/**
 * @file tests/integration/services/built-pool-merge.test.ts
 * @desc applyBuiltPoolOps merges a stale save onto the live content when the client sends the
 *       revision it saw (clean merges apply and record both revisions; a real conflict, an
 *       unknown base, or no base at all is still a 409 with the pool), and a non-content version
 *       bump (visibility) doesn't force a merge when the base still matches the row's head.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Oct 5, 2026
 * @modified Mon Oct 5, 2026
 */

import { describe, expect, it } from "vitest";
import { ensureHistory } from "@/services/built-pool-history";
import { applyBuiltPoolOps } from "@/services/built-pool-ops";
import { findBuiltPool } from "@/services/built-pool-read";
import { setBuiltPoolVisibility } from "@/services/built-pools";
import { setupTestDb } from "../../helpers/db";
import { type Cast, createCast, insertPool } from "../../helpers/pool-requests";

setupTestDb();

const ID = "b-a0000001";

/** The owner (or editor) as applyBuiltPoolOps' caller needs it. */
const caller = (cast: Cast, who: "owner" | "editor") => ({
  ...cast[who],
  avatarUrl: null,
  isAdmin: false,
});

/** Inserts the pool and its root revision (seq 0), returning that root's ref. */
const startPool = async (cast: Cast) => {
  await insertPool(cast, { _id: ID });
  const pool = await findBuiltPool(ID);
  if (!pool) throw new Error("pool not inserted");
  return ensureHistory(pool);
};

describe("applyBuiltPoolOps: merging stale saves", () => {
  it("merges two saves from the same base onto different buckets, cleanly", async () => {
    const cast = await createCast();
    const base = await startPool(cast);

    const first = await applyBuiltPoolOps(ID, caller(cast, "owner"), { baseVersion: 1, base }, [
      { type: "addMap", beatmapId: 1, bucket: "NM" },
    ]);
    expect(first).toMatchObject({ ok: true, value: { merged: false } });

    const second = await applyBuiltPoolOps(ID, caller(cast, "editor"), { baseVersion: 1, base }, [
      { type: "addMap", beatmapId: 2, bucket: "HD" },
    ]);
    expect(second).toMatchObject({ ok: true, value: { merged: true } });
    if (!second.ok) throw new Error("expected ok");
    expect(second.value.pool.slots.map((slot) => slot.beatmapId).sort()).toEqual([1, 2]);
  });

  it("is a 409 conflict when both sides rename the pool from the same base", async () => {
    const cast = await createCast();
    const base = await startPool(cast);

    await applyBuiltPoolOps(ID, caller(cast, "owner"), { baseVersion: 1, base }, [
      { type: "setDetails", name: "Owner's name" },
    ]);
    const second = await applyBuiltPoolOps(ID, caller(cast, "editor"), { baseVersion: 1, base }, [
      { type: "setDetails", name: "Editor's name" },
    ]);
    expect(second).toMatchObject({ ok: false, status: 409, code: "conflict" });
  });

  it("is a 409 for a stale version with no base at all (an old client)", async () => {
    const cast = await createCast();
    await insertPool(cast, { _id: ID, version: 2 });
    const answer = await applyBuiltPoolOps(ID, caller(cast, "owner"), { baseVersion: 1 }, [
      { type: "addMap", beatmapId: 1, bucket: "NM" },
    ]);
    expect(answer).toMatchObject({ ok: false, status: 409, code: "conflict" });
  });

  it("doesn't force a merge when only visibility moved the version but base still matches head", async () => {
    const cast = await createCast();
    const head = await startPool(cast);
    await setBuiltPoolVisibility(ID, caller(cast, "owner"), "unlisted");
    const answer = await applyBuiltPoolOps(
      ID,
      caller(cast, "editor"),
      { baseVersion: 1, base: head },
      [{ type: "addMap", beatmapId: 5, bucket: "NM" }],
    );
    expect(answer).toMatchObject({ ok: true, value: { merged: false } });
  });

  it("lands a candidate op from a stale base onto today's candidates", async () => {
    const cast = await createCast();
    const base = await startPool(cast);
    await applyBuiltPoolOps(ID, caller(cast, "owner"), { baseVersion: 1, base }, [
      { type: "addMap", beatmapId: 1, bucket: "NM" },
    ]);
    const answer = await applyBuiltPoolOps(ID, caller(cast, "editor"), { baseVersion: 1, base }, [
      { type: "addCandidate", slot: { bucket: "HD", index: 1 }, beatmapId: 2, beatmapsetId: null },
    ]);
    expect(answer).toMatchObject({ ok: true, value: { merged: true } });
    const stored = await findBuiltPool(ID);
    expect(stored?.candidates).toBeTruthy();
  });

  it("is a 409 when a merge lands two different maps in the same slot", async () => {
    const cast = await createCast();
    const base = await startPool(cast);
    await applyBuiltPoolOps(ID, caller(cast, "owner"), { baseVersion: 1, base }, [
      { type: "addMap", beatmapId: 1, bucket: "NM", index: 3 },
    ]);
    const answer = await applyBuiltPoolOps(ID, caller(cast, "editor"), { baseVersion: 1, base }, [
      { type: "addMap", beatmapId: 2, bucket: "NM", index: 3 },
    ]);
    expect(answer).toMatchObject({ ok: false, status: 409, code: "conflict" });
  });
});
