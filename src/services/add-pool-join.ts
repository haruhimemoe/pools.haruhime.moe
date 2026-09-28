/**
 * @file src/services/add-pool-join.ts
 * @desc Joining a new source to a stored pool record with the same fingerprint: one guarded
 *       $push of the source (never a $set of the sources from a snapshot) that revives a
 *       superseded record, nothing when the record already credits the same kind, name and
 *       link, and the ids a new host or community source can't take.
 * @author David @dvhsh (https://dvh.sh)
 * @created Fri Sep 25, 2026
 * @modified Mon Sep 28, 2026
 */

import "server-only";
import { MongoServerError } from "mongodb";
import { poolsCollection } from "@/models/Pool";
import type { PoolSource } from "@/schemas/pool";
import type { ExistingPool } from "@/utils/import-plan";
import { isVisible } from "@/utils/pool-record";
import type { SourceRef } from "@/utils/source-pools";

/**
 * @function takenIds
 * @param kind {string} a source kind
 * @param existing {readonly ExistingPool[]} the stored records
 * @returns {(id: string) => boolean} whether an id is taken for that kind: by a current or
 *          former source, or inside a pool id
 */
export const takenIds = (kind: string, existing: readonly ExistingPool[]) => {
  const ids = new Set<string>();
  const poolIds = existing.map((record) => record.id);
  for (const record of existing) {
    for (const source of [...record.sources, ...record.formerSources]) {
      if (source.kind === kind) ids.add(source.id);
    }
  }
  return (id: string): boolean =>
    ids.has(id) || poolIds.some((poolId) => poolId.startsWith(`${kind}-${id}`));
};

/**
 * @function isDuplicateKey
 * @param error {unknown} a write's error
 * @returns {boolean} true for MongoDB's duplicate key error (E11000)
 */
export const isDuplicateKey = (error: unknown): boolean =>
  error instanceof MongoServerError && error.code === 11000;

/**
 * @function sameCredit
 * @param entry {PoolSource} a source the record has
 * @param source {SourceRef} the source being added
 * @returns {boolean} true for the same kind, credit name and credit link
 */
export const sameCredit = (entry: PoolSource, source: SourceRef): boolean =>
  entry.kind === source.kind &&
  "credit" in entry &&
  "credit" in source &&
  entry.credit.name === source.credit.name &&
  (entry.credit.url ?? null) === (source.credit.url ?? null);

/**
 * @function joinStored
 * @param before {ExistingPool} the record as planning read it
 * @param entry {PoolSource} the source to push
 * @param at {Date} the add's time
 * @returns {Promise<boolean>} true when the source was pushed onto the record as planning read
 *          it (same fingerprint, same superseded state, and on a revival the same hidden); false
 *          when the record changed or that credit is there by then
 */
export const joinStored = async (
  before: ExistingPool,
  entry: PoolSource,
  at: Date,
): Promise<boolean> => {
  const revived = before.supersededBy !== null;
  const credit = "credit" in entry ? entry.credit : null;
  const filter = {
    _id: before.id,
    fingerprint: before.fingerprint,
    supersededBy: before.supersededBy,
    ...(revived ? { hidden: before.hidden } : {}),
    ...(credit
      ? {
          sources: {
            $not: {
              $elemMatch: {
                kind: entry.kind,
                "credit.name": credit.name,
                "credit.url": credit.url ?? null,
              },
            },
          },
        }
      : {}),
  };
  const set = revived
    ? { supersededBy: null, visible: isVisible({ ...before, supersededBy: null }), updatedAt: at }
    : { updatedAt: at };
  try {
    const pools = await poolsCollection();
    const result = await pools.updateOne(filter as never, { $push: { sources: entry }, $set: set });
    return result.matchedCount === 1;
  } catch (error) {
    if (isDuplicateKey(error)) return false;
    throw error;
  }
};
