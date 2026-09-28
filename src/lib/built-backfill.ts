/**
 * @file src/lib/built-backfill.ts
 * @desc Fills in the search fields (searchText, sortName, mapCount) on built pools written
 *       before every content write stored them, so "Built here" finds and sorts them. It runs
 *       once per process when the database connects (src/lib/db.ts, after the indexes) and
 *       reads only rows with no searchText, so once they're filled it costs one empty query.
 *       Each write is guarded the same way, so a pool changed meanwhile keeps its own fields.
 *       Idempotent. A database error is logged, never thrown: search just misses those rows
 *       until the next connect, and reads compute the fields themselves (builtSearchFieldsOf).
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

import "server-only";
import type { Db } from "mongodb";
import { BUILT_POOLS_COLLECTION, QUERY_TIME_MS } from "@/constants/db";
import { builtSearchFields } from "@/utils/built-record";

/** Rows written before the search fields were stored. */
const MISSING = { searchText: { $exists: false } };

type Row = { _id: string; name?: unknown; tournament?: unknown; round?: unknown; slots?: unknown };

const text = (value: unknown): string => (typeof value === "string" ? value : "");

/**
 * @function backfillBuiltSearchFields
 * @param db {Db} the pools database (raw: this runs inside connectDb)
 * @returns {Promise<number>} how many pools it filled in
 */
export const backfillBuiltSearchFields = async (db: Db): Promise<number> => {
  try {
    const pools = db.collection<Row>(BUILT_POOLS_COLLECTION);
    const rows = await pools
      .find(MISSING, {
        projection: { name: 1, tournament: 1, round: 1, "slots.beatmapId": 1 },
        maxTimeMS: QUERY_TIME_MS,
      })
      .toArray();
    if (rows.length === 0) return 0;
    const result = await pools.bulkWrite(
      rows.map((row) => ({
        updateOne: {
          filter: { _id: row._id, ...MISSING },
          update: {
            $set: builtSearchFields({
              name: text(row.name),
              tournament: text(row.tournament),
              round: text(row.round),
              slots: Array.isArray(row.slots) ? row.slots : [],
            }),
          },
        },
      })),
      { ordered: false },
    );
    return result.modifiedCount;
  } catch (error) {
    console.error("db: couldn't fill in built pools' search fields", error);
    return 0;
  }
};
