/**
 * @file src/models/BuiltPoolActivity.ts
 * @desc The built_pool_activity collection's Mongoose schema (src/schemas/activity.ts is the zod
 *       shape reads parse against) and its indexes: a pool's entries newest first, a TTL that
 *       drops an entry 180 days after it was written, and the osu! id (renaming a deleted
 *       account's entries). builtPoolActivityCollection() hands out the typed driver collection
 *       once the indexes exist.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import "server-only";
import type { Collection } from "mongodb";
import { type Model, Schema } from "mongoose";
import { ACTIVITY_TTL_SECONDS } from "@/constants/activity";
import { BUILT_POOL_ACTIVITY_COLLECTION, BUILT_POOL_ACTIVITY_INDEXES } from "@/constants/db";
import { connectDb, getDb, getModelConnection } from "@/lib/db";
import type { StoredActivity } from "@/schemas/activity";

const activitySchema = new Schema(
  {
    poolId: { type: String, required: true },
    at: { type: Date, required: true },
    osuId: { type: Number, default: null },
    username: { type: String, required: true },
    kind: { type: String, required: true },
    summary: { type: String, required: true },
    subject: { type: { osuId: Number, username: String }, default: undefined },
  },
  { collection: BUILT_POOL_ACTIVITY_COLLECTION, versionKey: false },
);

activitySchema.index({ poolId: 1, at: -1, _id: -1 }, { name: BUILT_POOL_ACTIVITY_INDEXES.pool });
activitySchema.index(
  { at: 1 },
  { name: BUILT_POOL_ACTIVITY_INDEXES.ttl, expireAfterSeconds: ACTIVITY_TTL_SECONDS },
);
activitySchema.index({ osuId: 1 }, { name: BUILT_POOL_ACTIVITY_INDEXES.osuId });
activitySchema.index(
  { "subject.osuId": 1 },
  { name: BUILT_POOL_ACTIVITY_INDEXES.subject, sparse: true },
);

/**
 * @function getActivityModel
 * @returns {Model<StoredActivity>} the model on the shared connection (registered once)
 */
export const getActivityModel = (): Model<StoredActivity> => {
  const connection = getModelConnection();
  return (
    (connection.models.BuiltPoolActivity as Model<StoredActivity> | undefined) ??
    connection.model<StoredActivity>("BuiltPoolActivity", activitySchema)
  );
};

/**
 * @function builtPoolActivityCollection
 * @returns {Promise<Collection<StoredActivity>>} built_pool_activity once connected and indexed
 */
export const builtPoolActivityCollection = async (): Promise<Collection<StoredActivity>> => {
  await connectDb();
  await getActivityModel().init();
  return getDb().collection<StoredActivity>(BUILT_POOL_ACTIVITY_COLLECTION);
};
