/**
 * @file src/models/Pool.ts
 * @desc The pools collection's Mongoose schema: the fields a pool record holds (src/schemas/pool.ts
 *       is the zod shape reads parse against) and every index, by the names src/constants/db.ts
 *       gives them: one current pool per fingerprint (partial unique over supersededBy null), one
 *       per public sort (each led by `visible`), beatmap id (map history and usage), sources,
 *       tournament key and year (badged edits), badged, and sync state. poolsCollection() hands
 *       out the typed driver collection once the indexes exist, since searches hint them by name.
 *       Registered lazily on the shared connection.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import "server-only";
import type { Collection } from "mongodb";
import { type Model, Schema } from "mongoose";
import { POOL_INDEXES, POOLS_COLLECTION } from "@/constants/db";
import { connectDb, getDb, getModelConnection } from "@/lib/db";
import type { StoredPool } from "@/schemas/pool";

// Validation is zod's job; the schema documents the fields and owns the indexes. Writes go
// through the driver with whole, zod-shaped values.
const poolSchema = new Schema(
  {
    _id: { type: String, required: true },
    name: { type: String, required: true },
    tournament: { type: String, required: true },
    round: { type: String, default: null },
    year: { type: Number, default: null },
    edited: { type: Schema.Types.Mixed, default: () => ({}) },
    tournamentKey: { type: String, required: true },
    badged: { type: Boolean, default: null },
    notes: { type: String, default: "" },
    sourceSlots: { type: [Schema.Types.Mixed], default: [] },
    slots: { type: [Schema.Types.Mixed], default: [] },
    buckets: { type: [Schema.Types.Mixed], default: undefined },
    fingerprint: { type: String, required: true },
    sources: { type: [Schema.Types.Mixed], default: [] },
    formerSources: { type: [Schema.Types.Mixed], default: [] },
    stats: { type: Schema.Types.Mixed, required: true },
    supersededBy: { type: String, default: null },
    hidden: { type: Boolean, default: false },
    visible: { type: Boolean, required: true },
    pack: { type: Schema.Types.Mixed, required: true },
    searchText: { type: String, required: true },
    sortName: { type: String, required: true },
    createdAt: { type: Date, required: true },
    updatedAt: { type: Date, required: true },
  },
  { collection: POOLS_COLLECTION, versionKey: false },
);

poolSchema.index(
  { fingerprint: 1 },
  {
    name: POOL_INDEXES.fingerprint,
    unique: true,
    partialFilterExpression: { supersededBy: { $type: "null" } },
  },
);
poolSchema.index({ visible: 1, year: -1, _id: 1 }, { name: POOL_INDEXES.year });
poolSchema.index({ visible: 1, sortName: 1, _id: 1 }, { name: POOL_INDEXES.name });
poolSchema.index({ visible: 1, "stats.count": -1, _id: 1 }, { name: POOL_INDEXES.maps });
poolSchema.index({ "slots.beatmapId": 1 }, { name: POOL_INDEXES.beatmap });
poolSchema.index({ "sources.kind": 1, "sources.id": 1 }, { name: POOL_INDEXES.source });
poolSchema.index({ tournamentKey: 1, year: 1 }, { name: POOL_INDEXES.tournament });
poolSchema.index({ visible: 1, badged: 1 }, { name: POOL_INDEXES.badged });
poolSchema.index({ "pack.state": 1 }, { name: POOL_INDEXES.packState });

/**
 * @function getPoolModel
 * @returns {Model<StoredPool>} the Pool model on the shared connection (registered once)
 */
export const getPoolModel = (): Model<StoredPool> => {
  const connection = getModelConnection();
  return (
    (connection.models.Pool as Model<StoredPool> | undefined) ??
    connection.model<StoredPool>("Pool", poolSchema)
  );
};

/**
 * @function poolsCollection
 * @returns {Promise<Collection<StoredPool>>} the pools collection once connected and indexed
 */
export const poolsCollection = async (): Promise<Collection<StoredPool>> => {
  await connectDb();
  await getPoolModel().init();
  return getDb().collection<StoredPool>(POOLS_COLLECTION);
};
