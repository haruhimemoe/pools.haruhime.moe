/**
 * @file tests/integration/models/indexes.test.ts
 * @desc The Mongoose schemas build every index by the names searches hint (built pools' too:
 *       owner, editor osu! id, visibility with updatedAt, hidden), and the fingerprint index
 *       keeps one current pool per fingerprint while superseded ones share it.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Sun Sep 27, 2026
 */

import { describe, expect, it } from "vitest";
import { BUILT_POOL_INDEXES, MAP_INDEXES, POOL_INDEXES } from "@/constants/db";
import { builtPoolsCollection } from "@/models/BuiltPool";
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

  it("builds every built_pools index", async () => {
    const indexes = await (await builtPoolsCollection()).indexes();
    expect(indexes.map((index) => index.name)).toEqual(
      expect.arrayContaining(Object.values(BUILT_POOL_INDEXES)),
    );
    expect(indexes.find((index) => index.name === BUILT_POOL_INDEXES.editor)?.key).toEqual({
      "editors.osuId": 1,
    });
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
