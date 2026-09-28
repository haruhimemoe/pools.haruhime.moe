/**
 * @file src/services/built-listings.ts
 * @desc Public built pools where public pages list them: the sitemap (every one), llms.txt and
 *       the home page's "Recently built" (the newest few). Public, not hidden and with maps
 *       only, newest change first, on the visibility-with-updatedAt index, each with its
 *       owner's osu! name. Empty under SKIP_ENV_VALIDATION (the CI build); at runtime a
 *       database error throws, so ISR keeps the last good page.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Mon Sep 28, 2026
 */

import "server-only";
import { isEnvValidationSkipped } from "@haruhimemoe/next-kit/env";
import { BUILT_POOL_INDEXES, QUERY_TIME_MS } from "@/constants/db";
import { builtPoolsCollection } from "@/models/BuiltPool";
import { ownerNamesOf } from "@/services/built-pools";

/** A public built pool as listings show it. */
export type ListedBuiltPool = {
  id: string;
  name: string;
  tournament: string;
  round: string;
  year: number | null;
  maps: number;
  builtBy: string | null;
  updatedAt: Date;
};

/** Every public built pool, at most (a public listing never reads without a bound). */
const LISTED_MAX = 5000;

/**
 * @function listPublicBuiltPools
 * @param limit {number} how many at most (default every one, up to 5000)
 * @returns {Promise<ListedBuiltPool[]>} public, unhidden built pools with maps, newest change
 *          first
 * @throws {Error} on a database error (ISR keeps the last good page)
 */
export const listPublicBuiltPools = async (
  limit: number = LISTED_MAX,
): Promise<ListedBuiltPool[]> => {
  if (isEnvValidationSkipped()) return [];
  const rows = await (await builtPoolsCollection())
    .find(
      // A pool made public before its first map has nothing to show yet.
      { visibility: "public", hidden: false, "slots.0": { $exists: true } },
      {
        projection: {
          name: 1,
          tournament: 1,
          round: 1,
          year: 1,
          ownerId: 1,
          updatedAt: 1,
          "slots.beatmapId": 1,
        },
        sort: { updatedAt: -1 },
        hint: BUILT_POOL_INDEXES.listed,
        limit: Math.min(limit, LISTED_MAX),
        maxTimeMS: QUERY_TIME_MS,
      },
    )
    .toArray();
  const owners = await ownerNamesOf(rows.map((row) => row.ownerId));
  return rows.map((row) => ({
    id: row._id,
    name: row.name,
    tournament: row.tournament,
    round: row.round,
    year: row.year,
    maps: row.slots.length,
    builtBy: owners.get(row.ownerId) ?? null,
    updatedAt: row.updatedAt,
  }));
};
