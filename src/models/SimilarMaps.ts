/**
 * @file src/models/SimilarMaps.ts
 * @desc The similar_maps collection: one row per beatmap id with its nearest maps by BoBERT's
 *       embeddings ({ _id, n: BinData uint32 ids, s: BinData uint8 scores, nl and sl: the same
 *       among leaderboard maps only, rev; rows imported before nl existed lack it }), written only
 *       by scripts/similar (into similar_maps_next, then renamed over this one). The app reads
 *       one row by _id; no index beyond _id. Empty or missing until the first import.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import "server-only";
import type { Binary, Collection } from "mongodb";
import { SIMILAR_MAPS_COLLECTION } from "@/constants/db";
import { connectDb, getDb } from "@/lib/db";

/** A similar_maps row as stored. */
export type StoredSimilarMaps = {
  _id: number;
  n: Binary;
  s: Binary;
  /** The top neighbors among leaderboard maps (ranked, approved, loved); missing on old rows. */
  nl?: Binary;
  sl?: Binary;
  rev: string;
};

/**
 * @function similarMapsCollection
 * @returns {Promise<Collection<StoredSimilarMaps>>} the similar_maps collection once connected
 */
export const similarMapsCollection = async (): Promise<Collection<StoredSimilarMaps>> => {
  await connectDb();
  return getDb().collection<StoredSimilarMaps>(SIMILAR_MAPS_COLLECTION);
};
