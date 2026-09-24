/**
 * @file src/models/Map.ts
 * @desc The maps collection's Mongoose schema: one row per beatmap (difficulty) id, the fields in
 *       src/schemas/map.ts, and the indexes map search hints (most used, last used, stars,
 *       length, title) plus set id (compliance cache lookups) and meta source (the mirror
 *       fill). mapsCollection() hands out the typed driver collection once they exist.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import "server-only";
import type { Collection } from "mongodb";
import { type Model, Schema } from "mongoose";
import { MAP_INDEXES, MAPS_COLLECTION } from "@/constants/db";
import { connectDb, getDb, getModelConnection } from "@/lib/db";
import type { StoredMap } from "@/schemas/map";

const mapSchema = new Schema(
  {
    _id: { type: Number, required: true },
    setId: { type: Number, default: null },
    artist: { type: String, default: null },
    title: { type: String, default: null },
    version: { type: String, default: null },
    setHost: { type: String, default: null },
    setHostId: { type: Number, default: null },
    mode: { type: String, default: null },
    ar: { type: Number, default: null },
    od: { type: Number, default: null },
    cs: { type: Number, default: null },
    hp: { type: Number, default: null },
    length: { type: Number, default: null },
    bpm: { type: Number, default: null },
    stars: { type: Number, default: null },
    checksum: { type: String, default: null },
    metaSource: { type: String, required: true },
    searchText: { type: String, required: true },
    sortTitle: { type: String, required: true },
    usage: { type: Schema.Types.Mixed, required: true },
    updatedAt: { type: Date, required: true },
  },
  { collection: MAPS_COLLECTION, versionKey: false },
);

mapSchema.index({ "usage.count": -1, _id: 1 }, { name: MAP_INDEXES.used });
mapSchema.index({ "usage.lastYear": -1, _id: 1 }, { name: MAP_INDEXES.last });
mapSchema.index({ stars: -1, _id: 1 }, { name: MAP_INDEXES.stars });
mapSchema.index({ length: -1, _id: 1 }, { name: MAP_INDEXES.length });
mapSchema.index({ sortTitle: 1, _id: 1 }, { name: MAP_INDEXES.title });
mapSchema.index({ setId: 1 }, { name: MAP_INDEXES.set });
mapSchema.index({ metaSource: 1 }, { name: MAP_INDEXES.metaSource });

/**
 * @function getMapModel
 * @returns {Model<StoredMap>} the Map model on the shared connection (registered once)
 */
export const getMapModel = (): Model<StoredMap> => {
  const connection = getModelConnection();
  return (
    (connection.models.Map as Model<StoredMap> | undefined) ??
    connection.model<StoredMap>("Map", mapSchema)
  );
};

/**
 * @function mapsCollection
 * @returns {Promise<Collection<StoredMap>>} the maps collection once connected and indexed
 */
export const mapsCollection = async (): Promise<Collection<StoredMap>> => {
  await connectDb();
  await getMapModel().init();
  return getDb().collection<StoredMap>(MAPS_COLLECTION);
};
