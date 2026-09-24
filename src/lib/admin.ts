/**
 * @file src/lib/admin.ts
 * @desc Who is admin: osu! user ids listed in ADMIN_OSU_IDS, read on every call, so removing one
 *       takes effect at the next request. A malformed list fails closed (nobody is admin) and is
 *       logged by name. Also the check the session hook runs on a user id.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import "server-only";
import { ObjectId } from "mongodb";
import { EnvError, getAdminOsuIds } from "@/env";
import { connectDb, getDb } from "@/lib/db";

/**
 * @function isAdminOsuId
 * @param osuId {unknown} an osu! user id
 * @returns {boolean} true when ADMIN_OSU_IDS lists it
 */
export const isAdminOsuId = (osuId: unknown): boolean => {
  if (typeof osuId !== "number") return false;
  try {
    return getAdminOsuIds().has(osuId);
  } catch (error) {
    if (!(error instanceof EnvError)) throw error;
    console.error(`[auth] ${error.message}`);
    return false;
  }
};

/**
 * @function isAdminUserId
 * @param userId {unknown} a user id as better-auth passes it (hex string) or an ObjectId
 * @returns {Promise<boolean>} true when that user's osu! id is an admin's
 */
export const isAdminUserId = async (userId: unknown): Promise<boolean> => {
  const id =
    userId instanceof ObjectId
      ? userId
      : typeof userId === "string" && ObjectId.isValid(userId)
        ? new ObjectId(userId)
        : null;
  if (!id) return false;
  await connectDb();
  const user = await getDb()
    .collection("user")
    .findOne({ _id: id }, { projection: { osuId: 1 } });
  return isAdminOsuId(user?.osuId);
};
