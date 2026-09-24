/**
 * @file tests/integration/models/indexes.test.ts
 * @desc The Mongoose schemas build every index by the names searches hint, and the fingerprint
 *       index keeps one current pool per fingerprint while superseded ones share it.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { describe, expect, it } from "vitest";
import { MAP_INDEXES, POOL_INDEXES } from "@/constants/db";
import { mapsCollection } from "@/models/Map";
import { poolsCollection } from "@/models/Pool";
import { setupTestDb } from "../../helpers/db";
import { makePool } from "../../helpers/records";

setupTestDb();

describe("indexes", () => {
  it("builds every pools index", async () => {
    const names = (await (await poolsCollection()).indexes()).map((index) => index.name);
    expect(names).toEqual(expect.arrayContaining(Object.values(POOL_INDEXES)));
  });

  it("builds every maps index", async () => {
    const names = (await (await mapsCollection()).indexes()).map((index) => index.name);
    expect(names).toEqual(expect.arrayContaining(Object.values(MAP_INDEXES)));
  });

  it("keeps one current pool per fingerprint, superseded ones aside", async () => {
    const pools = await poolsCollection();
    await pools.insertOne(makePool({ _id: "otdb-1", supersededBy: "otdb-1-2" }));
    await pools.insertOne(makePool({ _id: "otdb-1-2" }));
    await expect(pools.insertOne(makePool({ _id: "otdb-2" }))).rejects.toMatchObject({
      code: 11000,
    });
  });
});
