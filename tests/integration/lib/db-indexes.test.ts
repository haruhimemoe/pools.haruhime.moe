/**
 * @file tests/integration/lib/db-indexes.test.ts
 * @desc Connecting builds pools' own indexes (pool_revisions' unique docId+seq among them) and
 *       nothing in the hub's identity database, which pools' Atlas user can't write; and no
 *       better-auth collections or indexes in pools any more.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Tue Oct 6, 2026
 */

import { describe, expect, it } from "vitest";
import { POOL_REVISIONS_COLLECTION } from "@/constants/db";
import { connectDb, getDb, getIdentityDb } from "@/lib/db";
import { RAW_INDEXES } from "@/lib/db-indexes";
import { createTestUser } from "../../helpers/auth";
import { setupTestDb } from "../../helpers/db";

setupTestDb();

describe("pool_revisions indexes", () => {
  it("builds the unique docId+seq index on connect", async () => {
    const index = await getDb()
      .collection(POOL_REVISIONS_COLLECTION)
      .indexes()
      .then((indexes) => indexes.find((entry) => entry.key.docId === 1 && entry.key.seq === -1));
    expect(index).toMatchObject({ key: { docId: 1, seq: -1 }, unique: true });
  });
});

describe("identity", () => {
  it("builds nothing in identity, and lists no better-auth collection for pools", async () => {
    await createTestUser(5);
    await connectDb();
    for (const name of ["user", "session"]) {
      const indexes = await getIdentityDb().collection(name).indexes();
      expect(indexes.map((index) => index.name)).toEqual(["_id_"]);
    }
    const collections = new Set(RAW_INDEXES.map((spec) => spec.collection));
    for (const name of ["user", "account", "session", "verification"]) {
      expect(collections.has(name)).toBe(false);
    }
  });
});
