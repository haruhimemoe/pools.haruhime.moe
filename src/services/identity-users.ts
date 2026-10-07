/**
 * @file src/services/identity-users.ts
 * @desc Who has a haruhime account, read from the hub's identity database (read-only): the user
 *       id for an osu! id, for one editor or a pool's whole editor list. Editors can be added by
 *       osu! name before they ever sign in, and sign-in happens on haruhime.moe, so pools looks
 *       their account up here when it needs it instead of linking it at first sign-in.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Oct 6, 2026
 * @modified Tue Oct 6, 2026
 */

import "server-only";
import { QUERY_TIME_MS } from "@/constants/db";
import { connectDb, getIdentityDb } from "@/lib/db";

/**
 * @function userIdsFor
 * @param osuIds {readonly number[]} osu! ids
 * @returns {Promise<Map<number, string>>} each osu! id with a haruhime account, to its user id
 *          (one query; none for an empty list)
 */
export const userIdsFor = async (osuIds: readonly number[]): Promise<Map<number, string>> => {
  const ids = [...new Set(osuIds)];
  if (ids.length === 0) return new Map();
  await connectDb();
  const users = await getIdentityDb()
    .collection("user")
    .find({ osuId: { $in: ids } }, { projection: { osuId: 1 }, maxTimeMS: QUERY_TIME_MS })
    .toArray();
  return new Map(
    users.flatMap((user) =>
      typeof user.osuId === "number" ? [[user.osuId, String(user._id)] as const] : [],
    ),
  );
};

/**
 * @function userIdFor
 * @param osuId {number} an osu! id
 * @returns {Promise<string | null>} the user id of whoever signed in with it, or null when nobody
 *          has yet
 */
export const userIdFor = async (osuId: number): Promise<string | null> =>
  (await userIdsFor([osuId])).get(osuId) ?? null;
