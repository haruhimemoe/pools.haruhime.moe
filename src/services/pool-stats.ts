/**
 * @file src/services/pool-stats.ts
 * @desc Rebuilds pools' stats from their maps (src/utils/pool-stats.ts), for every pool or only
 *       the ones given, writing only the ones that changed. The importer runs it after the
 *       mirror fill.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import "server-only";
import type { AnyBulkWriteOperation } from "mongodb";
import { BATCH_QUERY_MS } from "@/constants/db";
import { mapsCollection } from "@/models/Map";
import { poolsCollection } from "@/models/Pool";
import type { StoredPool } from "@/schemas/pool";
import { computePoolStats, samePoolStats } from "@/utils/pool-stats";

/**
 * @function recomputePoolStats
 * @param ids {Iterable<string>} pool ids to rebuild (default: every pool)
 * @returns {Promise<number>} how many pools' stats changed
 */
export const recomputePoolStats = async (ids?: Iterable<string>): Promise<number> => {
  const only = ids === undefined ? null : [...new Set(ids)];
  const pools = await poolsCollection();
  const maps = await mapsCollection();
  const rows = await pools
    .find(only === null ? {} : { _id: { $in: only } }, {
      projection: { slots: 1, stats: 1 },
      maxTimeMS: BATCH_QUERY_MS,
    })
    .toArray();
  const mapIds = [...new Set(rows.flatMap((row) => row.slots.map((slot) => slot.beatmapId)))];
  const metas = new Map(
    (
      await maps
        .find(
          { _id: { $in: mapIds } },
          { projection: { stars: 1, length: 1, bpm: 1 }, maxTimeMS: BATCH_QUERY_MS },
        )
        .toArray()
    ).map((map) => [map._id, map]),
  );
  const ops: AnyBulkWriteOperation<StoredPool>[] = [];
  for (const row of rows) {
    const next = computePoolStats(row.slots, (id) => metas.get(id));
    if (!samePoolStats(row.stats, next)) {
      ops.push({ updateOne: { filter: { _id: row._id }, update: { $set: { stats: next } } } });
    }
  }
  if (ops.length > 0) await pools.bulkWrite(ops, { ordered: false });
  return ops.length;
};
