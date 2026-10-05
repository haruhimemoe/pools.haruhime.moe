/**
 * @file tests/integration/services/built-pool-history.test.ts
 * @desc ensureHistory makes a pool's root revision lazily and never twice, even racing itself;
 *       recordRevision commits a new revision when the content changed and nothing when it
 *       didn't; setHead never moves a row's head backwards.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Oct 5, 2026
 * @modified Mon Oct 5, 2026
 */

import { describe, expect, it } from "vitest";
import { poolRevisions } from "@/lib/pool-revisions";
import { builtPoolsCollection } from "@/models/BuiltPool";
import {
  authorOf,
  ensureHistory,
  HISTORY_START,
  recordRevision,
  SYSTEM_AUTHOR,
  setHead,
} from "@/services/built-pool-history";
import { makeBuiltPool } from "../../helpers/built-pools";
import { setupTestDb } from "../../helpers/db";

setupTestDb();

describe("ensureHistory", () => {
  it("creates a seq 0 root with HISTORY_START and SYSTEM_AUTHOR, and stores head on the row", async () => {
    const pool = makeBuiltPool();
    const ref = await ensureHistory(pool);
    expect(ref).toEqual({ id: expect.any(String), seq: 0 });
    const root = await poolRevisions.get(pool._id, ref.id);
    expect(root).toMatchObject({
      seq: 0,
      kind: "root",
      message: HISTORY_START,
      authorId: SYSTEM_AUTHOR.id,
      authorName: SYSTEM_AUTHOR.name,
    });
  });

  it("returns the same ref without writing again on a second call", async () => {
    const pool = makeBuiltPool();
    const first = await ensureHistory(pool);
    const second = await ensureHistory({ ...pool, head: first });
    expect(second).toEqual(first);
    const list = await poolRevisions.list(pool._id);
    expect(list).toHaveLength(1);
  });

  it("ends with one root when two calls race", async () => {
    const pool = makeBuiltPool();
    const [a, b] = await Promise.all([ensureHistory(pool), ensureHistory(pool)]);
    expect(a).toEqual(b);
    const list = await poolRevisions.list(pool._id);
    expect(list).toHaveLength(1);
  });
});

describe("recordRevision", () => {
  it("commits seq 1 and moves head after a content change", async () => {
    const pool = makeBuiltPool();
    const head = await ensureHistory(pool);
    const author = authorOf({ id: "u1", username: "owner" });
    const next = await recordRevision(
      pool._id,
      head,
      { ...pool, slots: [{ mod: "NM", index: 1, beatmapId: 5 }] },
      author,
    );
    expect(next.seq).toBe(1);
    const revision = await poolRevisions.get(pool._id, next.id);
    expect(revision?.value.slots).toEqual([{ mod: "NM", index: 1, beatmapId: 5 }]);
  });

  it("returns the old head and writes nothing for the same content", async () => {
    const pool = makeBuiltPool();
    const head = await ensureHistory(pool);
    const author = authorOf({ id: "u1", username: "owner" });
    const same = await recordRevision(pool._id, head, pool, author);
    expect(same).toEqual(head);
    const list = await poolRevisions.list(pool._id);
    expect(list).toHaveLength(1);
  });
});

describe("setHead", () => {
  it("never moves a row's head backwards", async () => {
    const pool = makeBuiltPool();
    await (await builtPoolsCollection()).insertOne(pool);
    await setHead(pool._id, { id: "r2", seq: 2 });
    await setHead(pool._id, { id: "r1", seq: 1 });
    const row = await (await builtPoolsCollection()).findOne({ _id: pool._id });
    expect(row?.head).toEqual({ id: "r2", seq: 2 });
  });
});
