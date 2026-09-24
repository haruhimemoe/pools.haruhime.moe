/**
 * @file src/services/import.ts
 * @desc Import writes: the stored records as planning reads them; a plan written (new records
 *       inserted whole, with no stats yet and no pack; changed records get the importer's
 *       fields and what derives from them, never hidden, badged, edited, stats or the pack
 *       state); and map rows seeded from the export for the run's maps (a stored map is never
 *       overwritten: the mirror's values win).
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
import { emptyPackSync, type StoredPool } from "@/schemas/pool";
import type { ExistingPool, ImportPlan, PlannedPool } from "@/utils/import-plan";
import { type MapSeed, seededMap } from "@/utils/map-record";
import { derivedFields, effectiveFields, isVisible } from "@/utils/pool-record";
import { emptyPoolStats } from "@/utils/pool-stats";

/** The fields an import writes on every record it touches (buckets aside). */
const importerFields = (pool: PlannedPool) => {
  const fields = effectiveFields(pool.name, pool.edited);
  return {
    name: pool.name,
    ...fields,
    ...derivedFields(pool.name, fields),
    notes: pool.notes,
    sourceSlots: pool.sourceSlots,
    slots: pool.slots,
    fingerprint: pool.fingerprint,
    sources: pool.sources,
    formerSources: pool.formerSources,
    supersededBy: pool.supersededBy,
    visible: isVisible(pool),
  };
};

/**
 * @function loadExistingPools
 * @returns {Promise<ExistingPool[]>} every stored record, as planning needs it
 */
export const loadExistingPools = async (): Promise<ExistingPool[]> => {
  const pools = await poolsCollection();
  const rows = await pools.find({}, { maxTimeMS: BATCH_QUERY_MS }).toArray();
  return rows.map((row) => ({
    id: row._id,
    name: row.name,
    notes: row.notes,
    sourceSlots: row.sourceSlots,
    slots: row.slots,
    ...(row.buckets ? { buckets: row.buckets } : {}),
    fingerprint: row.fingerprint,
    sources: row.sources,
    formerSources: row.formerSources,
    supersededBy: row.supersededBy,
    hidden: row.hidden,
    badged: row.badged,
    edited: row.edited ?? {},
  }));
};

/**
 * @function newPoolDoc
 * @param pool {PlannedPool} a record to create
 * @param now {Date} the run's clock
 * @returns {StoredPool} the whole row: no stats yet, never sent to packs
 */
export const newPoolDoc = (pool: PlannedPool, now: Date): StoredPool => ({
  _id: pool.id,
  ...importerFields(pool),
  ...(pool.buckets ? { buckets: pool.buckets } : {}),
  edited: pool.edited,
  badged: pool.badged,
  hidden: pool.hidden,
  stats: emptyPoolStats(pool.slots.length),
  pack: emptyPackSync(),
  createdAt: now,
  updatedAt: now,
});

/**
 * @function applyImportPlan
 * @param plan {ImportPlan} what planImport decided
 * @param now {Date} the run's clock
 * @returns {Promise<{ created: number; updated: number }>} how many records it wrote
 */
export const applyImportPlan = async (
  plan: ImportPlan,
  now: Date,
): Promise<{ created: number; updated: number }> => {
  const pools = await poolsCollection();
  const ops: AnyBulkWriteOperation<StoredPool>[] = [
    ...plan.updates.map(({ pool }) => ({
      updateOne: {
        filter: { _id: pool.id },
        update: pool.buckets
          ? { $set: { ...importerFields(pool), buckets: pool.buckets, updatedAt: now } }
          : { $set: { ...importerFields(pool), updatedAt: now }, $unset: { buckets: "" as const } },
      },
    })),
    ...plan.creates.map(({ pool }) => ({ insertOne: { document: newPoolDoc(pool, now) } })),
  ];
  if (ops.length > 0) await pools.bulkWrite(ops, { ordered: true });
  return { created: plan.creates.length, updated: plan.updates.length };
};

/**
 * @function seedMaps
 * @param seeds {ReadonlyMap<number, MapSeed>} what the export says about each map
 * @param ids {Iterable<number>} the run's map ids
 * @param now {Date} the run's clock
 * @returns {Promise<number>} how many new map rows it inserted (stored maps are left as they are)
 */
export const seedMaps = async (
  seeds: ReadonlyMap<number, MapSeed>,
  ids: Iterable<number>,
  now: Date,
): Promise<number> => {
  const maps = await mapsCollection();
  const ops: AnyBulkWriteOperation<StoredMap>[] = [];
  for (const id of new Set(ids)) {
    const seed = seeds.get(id);
    if (!seed) continue;
    const { _id, ...fields } = seededMap(id, seed, now);
    ops.push({ updateOne: { filter: { _id }, update: { $setOnInsert: fields }, upsert: true } });
  }
  if (ops.length === 0) return 0;
  return (await maps.bulkWrite(ops, { ordered: false })).upsertedCount;
};
