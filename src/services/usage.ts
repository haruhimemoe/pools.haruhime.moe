/**
 * @file src/services/usage.ts
 * @desc Rebuilds map usage from the pools that aren't hidden (src/utils/usage.ts), for every map
 *       or only the ones given, writing only rows whose usage changed. The importer runs it for
 *       every map; admin saves run it for a pool's maps when its hidden flag or year changes.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import "server-only";
import type { AnyBulkWriteOperation } from "mongodb";
import { BATCH_QUERY_MS } from "@/constants/db";
import { mapsCollection } from "@/models/Map";
import { poolsCollection } from "@/models/Pool";
import type { StoredMap } from "@/schemas/map";
import { buildUsage, emptyMapUsage, sameUsage } from "@/utils/usage";

/**
 * @function recomputeUsage
 * @param ids {Iterable<number>} beatmap ids to rebuild (default: every map)
 * @returns {Promise<{ maps: number; updated: number }>} rows looked at and rows written
 */
export const recomputeUsage = async (
  ids?: Iterable<number>,
): Promise<{ maps: number; updated: number }> => {
  const only = ids === undefined ? null : [...new Set(ids)];
  if (only !== null && only.length === 0) return { maps: 0, updated: 0 };
  const pools = await poolsCollection();
  const maps = await mapsCollection();
  const rows = await pools
    .find(only === null ? { hidden: false } : { hidden: false, "slots.beatmapId": { $in: only } }, {
      projection: { year: 1, slots: 1, buckets: 1, supersededBy: 1 },
      maxTimeMS: BATCH_QUERY_MS,
    })
    .toArray();
  const usage = buildUsage(
    rows.map((row) => ({
      id: row._id,
      year: row.year,
      current: row.supersededBy === null,
      slots: row.slots,
      buckets: row.buckets,
    })),
  );
  const stored = await maps
    .find(only === null ? {} : { _id: { $in: only } }, {
      projection: { usage: 1 },
      maxTimeMS: BATCH_QUERY_MS,
    })
    .toArray();
  const ops: AnyBulkWriteOperation<StoredMap>[] = [];
  for (const map of stored) {
    const next = usage.get(map._id) ?? emptyMapUsage();
    if (!sameUsage(map.usage, next)) {
      ops.push({ updateOne: { filter: { _id: map._id }, update: { $set: { usage: next } } } });
    }
  }
  if (ops.length > 0) await maps.bulkWrite(ops, { ordered: false });
  return { maps: stored.length, updated: ops.length };
};
