/**
 * @file src/models/ModValues.ts
 * @desc The mod_values collection's Mongoose schema: one row per beatmap id and mod combo (_id
 *       "<beatmap id>:<combo>") holding the mirror's stars, AR, OD, CS and BPM under that combo,
 *       or a `rest` (the mirror lacked the id, or the call failed) that holds off asking again a
 *       while, removed by a TTL index 30 days after it was fetched. modValuesCollection() hands
 *       out the typed driver collection once the index exists.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Mon Sep 28, 2026
 */

import "server-only";
import type { Collection } from "mongodb";
import { type Model, Schema } from "mongoose";
import { MOD_VALUES_COLLECTION, MOD_VALUES_INDEXES } from "@/constants/db";
import { MOD_VALUES_TTL_SECONDS } from "@/constants/mod-values";
import { connectDb, getDb, getModelConnection } from "@/lib/db";
import type { StoredModRest, StoredModValues } from "@/schemas/mod-values";

const modValuesSchema = new Schema(
  {
    _id: { type: String, required: true },
    beatmapId: { type: Number, required: true },
    mods: { type: String, required: true },
    stars: { type: Number },
    ar: { type: Number },
    od: { type: Number },
    cs: { type: Number },
    bpm: { type: Number },
    // Instead of the values: the mirror lacked the id ("missing") or the call failed ("failed").
    rest: { type: String, enum: ["missing", "failed"] },
    fetchedAt: { type: Date, required: true },
  },
  { collection: MOD_VALUES_COLLECTION, versionKey: false },
);

modValuesSchema.index(
  { fetchedAt: 1 },
  { name: MOD_VALUES_INDEXES.ttl, expireAfterSeconds: MOD_VALUES_TTL_SECONDS },
);

/**
 * @function getModValuesModel
 * @returns {Model<StoredModValues>} the ModValues model on the shared connection (registered once)
 */
export const getModValuesModel = (): Model<StoredModValues> => {
  const connection = getModelConnection();
  return (
    (connection.models.ModValues as Model<StoredModValues> | undefined) ??
    connection.model<StoredModValues>("ModValues", modValuesSchema)
  );
};

/**
 * @function modValuesCollection
 * @returns {Promise<Collection<StoredModValues | StoredModRest>>} the mod_values collection once
 *          connected and indexed
 */
export const modValuesCollection = async (): Promise<
  Collection<StoredModValues | StoredModRest>
> => {
  await connectDb();
  await getModValuesModel().init();
  return getDb().collection<StoredModValues | StoredModRest>(MOD_VALUES_COLLECTION);
};
