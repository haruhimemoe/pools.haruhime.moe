/**
 * @file tests/integration/services/built-pool-history-read.test.ts
 * @desc loadPoolHistory and loadPoolRevision gate on historyAccessOf (404 for a pool the caller
 *       can't see, 403 history_private for one they see without read rights); the list is newest
 *       first, paged at 50 with `older` set on a full page; a first read of a pre-history pool
 *       creates its root; loadPoolRevision diffs against the previous revision (none for the
 *       root) and, for non-members, hides a note a newer filter would refuse from both sides.
 *       setHistoryPublic is owner-only and a no-op when the value doesn't change.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Oct 5, 2026
 * @modified Mon Oct 5, 2026
 */

import { describe, expect, it } from "vitest";
import { poolRevisions } from "@/lib/pool-revisions";
import { ensureHistory } from "@/services/built-pool-history";
import {
  loadPoolHistory,
  loadPoolRevision,
  setHistoryPublic,
} from "@/services/built-pool-history-read";
import { applyBuiltPoolOps } from "@/services/built-pool-ops";
import { findBuiltPool } from "@/services/built-pool-read";
import { setupTestDb } from "../../helpers/db";
import { type Cast, createCast, insertPool } from "../../helpers/pool-requests";

setupTestDb();

const ID = "b-a0000001";

const caller = (cast: Cast, who: "owner" | "editor" | "other") => ({
  ...cast[who],
  avatarUrl: null,
  isAdmin: false,
});

describe("loadPoolHistory", () => {
  it("is 404 for a pool the caller can't see", async () => {
    const cast = await createCast();
    await insertPool(cast, { _id: ID, visibility: "private" });
    const answer = await loadPoolHistory(ID, caller(cast, "other"));
    expect(answer).toMatchObject({ ok: false, status: 404 });
  });

  it("is 403 history_private for someone who sees the pool but not its history", async () => {
    const cast = await createCast();
    await insertPool(cast, { _id: ID, visibility: "public" });
    const answer = await loadPoolHistory(ID, caller(cast, "other"));
    expect(answer).toMatchObject({ ok: false, status: 403, code: "history_private" });
  });

  it("creates the root on a first read of a pre-history pool, newest first", async () => {
    const cast = await createCast();
    await insertPool(cast, { _id: ID });
    const answer = await loadPoolHistory(ID, caller(cast, "owner"));
    expect(answer).toMatchObject({ ok: true, value: { revisions: [{ seq: 0 }], older: null } });
    const stored = await findBuiltPool(ID);
    expect(stored?.head).toMatchObject({ seq: 0 });
  });
});

describe("loadPoolRevision", () => {
  it("diffs against the previous revision, none for the root", async () => {
    const cast = await createCast();
    await insertPool(cast, { _id: ID });
    const history = await loadPoolHistory(ID, caller(cast, "owner"));
    if (!history.ok) throw new Error("expected ok");
    const root = history.value.revisions[0];
    if (!root) throw new Error("expected a root revision");
    const rootView = await loadPoolRevision(ID, caller(cast, "owner"), root.id);
    expect(rootView).toMatchObject({ ok: true, value: { previous: null, changes: [] } });

    await applyBuiltPoolOps(ID, caller(cast, "owner"), { baseVersion: 1 }, [
      { type: "addMap", beatmapId: 1, bucket: "NM" },
    ]);
    const after = await loadPoolHistory(ID, caller(cast, "owner"));
    if (!after.ok) throw new Error("expected ok");
    const latest = after.value.revisions[0];
    if (!latest) throw new Error("expected a revision");
    const view = await loadPoolRevision(ID, caller(cast, "owner"), latest.id);
    expect(view).toMatchObject({ ok: true, value: { previous: { seq: 0 } } });
    if (view.ok) expect(view.value.changes.length).toBeGreaterThan(0);
  });

  it("hides a slot note a newer filter would refuse from a non-member", async () => {
    const cast = await createCast();
    await insertPool(cast, { _id: ID, visibility: "public", historyPublic: true });
    const inserted = await findBuiltPool(ID);
    if (!inserted) throw new Error("expected the pool to be inserted");
    const ref = await ensureHistory(inserted);
    const base = await poolRevisions.get(ID, ref.id);
    if (!base) throw new Error("expected the root revision");
    // Write a note directly through the store (no filter), as a stale pre-filter note would be.
    await poolRevisions.commit({
      docId: ID,
      base: { id: base.id, seq: base.seq },
      value: {
        ...base.value,
        slotNotes: { "1": "kike note" },
        slots: [{ mod: "NM", index: 1, beatmapId: 1 }],
      },
      author: { id: "owner", name: "owner" },
    });
    const history = await loadPoolHistory(ID, caller(cast, "other"));
    if (!history.ok) throw new Error("expected ok");
    const latest = history.value.revisions[0];
    if (!latest) throw new Error("expected a revision");
    const view = await loadPoolRevision(ID, caller(cast, "other"), latest.id);
    expect(view).toMatchObject({ ok: true });
    if (view.ok) expect(view.value.after.slotNotes).toEqual({});
  });
});

describe("setHistoryPublic", () => {
  it("is owner-only, and a no-op when the value doesn't change", async () => {
    const cast = await createCast();
    await insertPool(cast, { _id: ID });
    const byEditor = await setHistoryPublic(ID, caller(cast, "editor"), true);
    expect(byEditor).toMatchObject({ ok: false, status: 403 });
    const unchanged = await setHistoryPublic(ID, caller(cast, "owner"), false);
    expect(unchanged).toMatchObject({ ok: true, value: { version: 1 } });
    const changed = await setHistoryPublic(ID, caller(cast, "owner"), true);
    expect(changed).toMatchObject({ ok: true, value: { version: 2 } });
    expect((await findBuiltPool(ID))?.historyPublic).toBe(true);
  });
});
