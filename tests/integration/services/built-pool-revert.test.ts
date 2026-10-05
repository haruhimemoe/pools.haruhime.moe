/**
 * @file tests/integration/services/built-pool-revert.test.ts
 * @desc revertBuiltPool: reverting to the root after two saves restores slots and details and
 *       adds a revert revision whose base is the root; a revision today's content filter would
 *       refuse (written directly through the store, bypassing the filter) is a 400
 *       content_filter and adds no revision; candidates present today survive unless their map is
 *       now a pick; reverting to the current content is a no-op.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Oct 5, 2026
 * @modified Mon Oct 5, 2026
 */

import { describe, expect, it } from "vitest";
import { poolRevisions } from "@/lib/pool-revisions";
import { ensureHistory } from "@/services/built-pool-history";
import { applyBuiltPoolOps } from "@/services/built-pool-ops";
import { findBuiltPool } from "@/services/built-pool-read";
import { revertBuiltPool } from "@/services/built-pool-revert";
import { setupTestDb } from "../../helpers/db";
import { type Cast, createCast, insertPool } from "../../helpers/pool-requests";

setupTestDb();

const ID = "b-a0000001";

const caller = (cast: Cast, who: "owner" | "editor" | "other") => ({
  ...cast[who],
  avatarUrl: null,
  isAdmin: false,
});

describe("revertBuiltPool", () => {
  it("restores slots and details from the root, adding a revert revision based on it", async () => {
    const cast = await createCast();
    await insertPool(cast, { _id: ID });
    const inserted = await findBuiltPool(ID);
    if (!inserted) throw new Error("expected the pool");
    const root = await ensureHistory(inserted);

    await applyBuiltPoolOps(ID, caller(cast, "owner"), { baseVersion: 1 }, [
      { type: "addMap", beatmapId: 1, bucket: "NM" },
      { type: "setDetails", name: "Renamed" },
    ]);

    const answer = await revertBuiltPool(ID, caller(cast, "owner"), root.id);
    expect(answer).toMatchObject({ ok: true, value: { name: "Spring Cup Finals", slots: [] } });

    const revisions = await poolRevisions.list(ID);
    expect(revisions[0]).toMatchObject({ kind: "revert", base: root.id });
  });

  it("is a 400 content_filter for a revision today's rules refuse, adding no revision", async () => {
    const cast = await createCast();
    await insertPool(cast, { _id: ID });
    const inserted = await findBuiltPool(ID);
    if (!inserted) throw new Error("expected the pool");
    const ref = await ensureHistory(inserted);
    const base = await poolRevisions.get(ID, ref.id);
    if (!base) throw new Error("expected the root");
    // Write a refused name directly through the store (commit runs no filter).
    const bad = await poolRevisions.commit({
      docId: ID,
      base: { id: base.id, seq: base.seq },
      value: { ...base.value, name: "retard cup" },
      author: { id: "owner", name: "owner" },
    });
    expect(bad.status).toBe("committed");
    const badId = bad.status === "committed" ? bad.revision.id : "";

    const before = await poolRevisions.list(ID);
    const answer = await revertBuiltPool(ID, caller(cast, "owner"), badId);
    expect(answer).toMatchObject({ ok: false, status: 400, code: "content_filter" });
    expect(await poolRevisions.list(ID)).toHaveLength(before.length);
  });

  it("is a no-op when reverting to the current content", async () => {
    const cast = await createCast();
    await insertPool(cast, { _id: ID });
    const inserted = await findBuiltPool(ID);
    if (!inserted) throw new Error("expected the pool");
    const root = await ensureHistory(inserted);
    const before = await poolRevisions.list(ID);
    const answer = await revertBuiltPool(ID, caller(cast, "owner"), root.id);
    expect(answer).toMatchObject({ ok: true, value: { version: 1 } });
    expect(await poolRevisions.list(ID)).toHaveLength(before.length);
  });

  it("is 404 for an unknown revision", async () => {
    const cast = await createCast();
    await insertPool(cast, { _id: ID });
    const inserted = await findBuiltPool(ID);
    if (!inserted) throw new Error("expected the pool");
    await ensureHistory(inserted);
    expect(await revertBuiltPool(ID, caller(cast, "owner"), "nope")).toMatchObject({
      ok: false,
      status: 404,
    });
  });

  it("on a hidden public pool: 404 for a non-member visitor, 403 for an admin (they can see it)", async () => {
    const cast = await createCast();
    await insertPool(cast, { _id: ID, visibility: "public", hidden: true });
    const inserted = await findBuiltPool(ID);
    if (!inserted) throw new Error("expected the pool");
    const root = await ensureHistory(inserted);
    const other = await revertBuiltPool(ID, caller(cast, "other"), root.id);
    expect(other).toMatchObject({ ok: false, status: 404 });
    const admin = await revertBuiltPool(
      ID,
      { ...cast.admin, avatarUrl: null, isAdmin: true },
      root.id,
    );
    expect(admin).toMatchObject({ ok: false, status: 403 });
  });
});
