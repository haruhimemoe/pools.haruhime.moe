/**
 * @file tests/integration/lib/built-backfill.test.ts
 * @desc The connect-time backfill of built pools' search fields: rows written before
 *       searchText, sortName and mapCount were stored get them (so search finds them), rows
 *       that have them are left alone, a second run changes nothing, connecting runs it, and a
 *       database error is logged, never thrown.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Mon Sep 28, 2026
 */

import type { Db } from "mongodb";
import { describe, expect, it, vi } from "vitest";
import { backfillBuiltSearchFields } from "@/lib/built-backfill";
import { closeDb, connectDb, getDb } from "@/lib/db";
import { builtPoolsCollection } from "@/models/BuiltPool";
import { searchPools } from "@/services/search";
import { EMPTY_POOL_FILTERS } from "@/utils/search-filters";
import { makeBuiltPool } from "../../helpers/built-pools";
import { setupTestDb } from "../../helpers/db";

setupTestDb();

const slots = [{ mod: "NM", index: 1, beatmapId: 1 }];
const OLD = makeBuiltPool({ _id: "b-a0000001", name: "Café Cup", visibility: "public", slots });
const NEW = {
  ...makeBuiltPool({ _id: "b-a0000002", visibility: "public" }),
  searchText: "kept",
  sortName: "kept",
  mapCount: 7,
};

const fieldsOf = async (id: string) =>
  (await (
    await builtPoolsCollection()
  ).findOne(
    { _id: id },
    { projection: { _id: 0, searchText: 1, sortName: 1, mapCount: 1 } },
  )) as Record<string, unknown> | null;

describe("backfillBuiltSearchFields", () => {
  it("fills in rows written without the fields, once, and leaves the rest", async () => {
    await (await builtPoolsCollection()).insertMany([OLD, NEW]);
    expect(await backfillBuiltSearchFields(getDb())).toBe(1);
    expect(await fieldsOf("b-a0000001")).toEqual({
      searchText: "cafe cup\nspring cup\nfinals",
      sortName: "cafe cup",
      mapCount: 1,
    });
    expect(await fieldsOf("b-a0000002")).toEqual({
      searchText: "kept",
      sortName: "kept",
      mapCount: 7,
    });
    expect(await backfillBuiltSearchFields(getDb())).toBe(0);
    const found = await searchPools({ ...EMPTY_POOL_FILTERS, type: "built", q: "cafe" }, 1);
    expect("results" in found && found.results.map((pool) => pool.id)).toEqual(["b-a0000001"]);
  });

  it("runs when the database connects", async () => {
    await (await builtPoolsCollection()).insertOne(OLD);
    await closeDb();
    await connectDb();
    expect(await fieldsOf("b-a0000001")).toMatchObject({ sortName: "cafe cup", mapCount: 1 });
  });

  it("logs a database error and goes on", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const broken = {
      collection: () => {
        throw new Error("down");
      },
    } as unknown as Db;
    expect(await backfillBuiltSearchFields(broken)).toBe(0);
    expect(logged).toHaveBeenCalled();
    logged.mockRestore();
  });
});
