/**
 * @file src/models/BuiltPool.ts
 * @desc The built_pools collection's Mongoose schema: the fields a pool built here holds
 *       (src/schemas/built-pool.ts is the zod shape reads parse against) and its indexes, by the
 *       names src/constants/db.ts gives them: owner with updatedAt (your pools, the per-owner
 *       count), editor osu! id (pools you edit, pulling a deleted user), visibility with
 *       updatedAt (public listings), hidden (moderation). builtPoolsCollection() hands out the
 *       typed driver collection once the indexes exist; builtPoolIdsCollection() holds every id
 *       ever handed out, so a deleted pool's id is never reused. Registered lazily on the
 *       shared connection.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

import "server-only";
import type { Collection } from "mongodb";
import { type Model, Schema } from "mongoose";
import {
  BUILT_POOL_IDS_COLLECTION,
  BUILT_POOL_INDEXES,
  BUILT_POOLS_COLLECTION,
} from "@/constants/db";
import { connectDb, getDb, getModelConnection } from "@/lib/db";
import type { StoredBuiltPool } from "@/schemas/built-pool";

// Validation is zod's job; the schema documents the fields and owns the indexes. Writes go
// through the driver with whole, zod-shaped values.
const builtPoolSchema = new Schema(
  {
    _id: { type: String, required: true },
    name: { type: String, required: true },
    tournament: { type: String, default: "" },
    round: { type: String, default: "" },
    year: { type: Number, default: null },
    notes: { type: String, default: "" },
    visibility: { type: String, required: true },
    ownerId: { type: String, required: true },
    editors: { type: [Schema.Types.Mixed], default: [] },
    buckets: { type: [Schema.Types.Mixed], default: undefined },
    slots: { type: [Schema.Types.Mixed], default: [] },
    version: { type: Number, required: true },
    pack: { type: Schema.Types.Mixed, required: true },
    hidden: { type: Boolean, default: false },
    startedFrom: { type: String, default: null },
    createdAt: { type: Date, required: true },
    updatedAt: { type: Date, required: true },
  },
  { collection: BUILT_POOLS_COLLECTION, versionKey: false },
);

builtPoolSchema.index({ ownerId: 1, updatedAt: -1 }, { name: BUILT_POOL_INDEXES.owner });
builtPoolSchema.index({ "editors.osuId": 1 }, { name: BUILT_POOL_INDEXES.editor });
builtPoolSchema.index({ visibility: 1, updatedAt: -1 }, { name: BUILT_POOL_INDEXES.listed });
builtPoolSchema.index({ hidden: 1 }, { name: BUILT_POOL_INDEXES.hidden });

/**
 * @function getBuiltPoolModel
 * @returns {Model<StoredBuiltPool>} the BuiltPool model on the shared connection (registered once)
 */
export const getBuiltPoolModel = (): Model<StoredBuiltPool> => {
  const connection = getModelConnection();
  return (
    (connection.models.BuiltPool as Model<StoredBuiltPool> | undefined) ??
    connection.model<StoredBuiltPool>("BuiltPool", builtPoolSchema)
  );
};

/**
 * @function builtPoolsCollection
 * @returns {Promise<Collection<StoredBuiltPool>>} built_pools once connected and indexed
 */
export const builtPoolsCollection = async (): Promise<Collection<StoredBuiltPool>> => {
  await connectDb();
  await getBuiltPoolModel().init();
  return getDb().collection<StoredBuiltPool>(BUILT_POOLS_COLLECTION);
};

/**
 * @function builtPoolIdsCollection
 * @returns {Promise<Collection<{ _id: string; claimedAt: Date }>>} every built pool id ever used
 */
export const builtPoolIdsCollection = async (): Promise<
  Collection<{ _id: string; claimedAt: Date }>
> => {
  await connectDb();
  return getDb().collection<{ _id: string; claimedAt: Date }>(BUILT_POOL_IDS_COLLECTION);
};
