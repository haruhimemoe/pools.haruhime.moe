/**
 * @file src/services/count.ts
 * @desc Counts for public requests: MongoDB's count command on a hinted index, under maxTimeMS.
 *       The driver's countDocuments sends an aggregation ($match, then $group), and the spec keeps
 *       aggregation pipelines off public requests (the cluster is a shared free M0).
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import "server-only";
import type { Collection, Document } from "mongodb";
import { connectedDb } from "@/lib/db";

/**
 * @function countMatching
 * @param collection {Collection<T>} the collection to count in (a pools database collection)
 * @param filter {Document} the query
 * @param options {{ hint: string; maxTimeMS: number }} the index to use and the time limit
 * @returns {Promise<number>} how many documents match
 */
export const countMatching = async <T extends Document>(
  collection: Collection<T>,
  filter: Document,
  options: { hint: string; maxTimeMS: number },
): Promise<number> => {
  const db = await connectedDb();
  const answer = await db.command({
    count: collection.collectionName,
    query: filter,
    hint: options.hint,
    maxTimeMS: options.maxTimeMS,
  });
  return Number(answer.n ?? 0);
};
