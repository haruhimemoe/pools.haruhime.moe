/**
 * @file tests/helpers/auth.ts
 * @desc createTestUser(): an identity user and session written straight into the identity
 *       database (standing in for the haruhime.moe hub, which pools itself never writes), with the
 *       signed session cookie a browser would send. createTestAdmin() is the same for an osu! id
 *       that ADMIN_OSU_IDS lists (admin rights are read per request, so the test stubs the
 *       list).
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Tue Oct 6, 2026
 */

import { randomBytes } from "node:crypto";
import { TEST_OSU_APP_ENV } from "@haruhimemoe/next-kit/testing";
import { makeSignature } from "better-auth/crypto";
import { ObjectId } from "mongodb";
import { connectDb, getIdentityDb } from "@/lib/db";

export const ADMIN_OSU_ID = 12231334;

export type TestUser = { id: string; osuId: number; username: string; cookie: string };

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * @function createTestUser
 * @param osuId {number} the user's osu! id
 * @param username {string} their osu! username (default player<osuId>)
 * @param fields {Record<string, unknown>} extra identity user fields (bannedAt, system)
 * @returns {Promise<TestUser>} the user's id, osu! id, username and session cookie
 */
export const createTestUser = async (
  osuId: number,
  username = `player${osuId}`,
  fields: Record<string, unknown> = {},
): Promise<TestUser> => {
  await connectDb();
  const identity = getIdentityDb();
  const now = new Date();
  const _id = new ObjectId();
  await identity.collection("user").insertOne({
    _id,
    email: `${osuId}@osu.local`,
    emailVerified: false,
    name: username,
    osuId,
    username,
    avatarUrl: null,
    createdAt: now,
    updatedAt: now,
    ...fields,
  });
  const token = randomBytes(24).toString("base64url");
  await identity.collection("session").insertOne({
    _id: new ObjectId(),
    token,
    userId: _id,
    expiresAt: new Date(now.getTime() + 30 * DAY_MS),
    createdAt: now,
    updatedAt: now,
  });
  const signature = await makeSignature(token, TEST_OSU_APP_ENV.BETTER_AUTH_SECRET);
  const cookie = `better-auth.session_token=${encodeURIComponent(`${token}.${signature}`)}`;
  return { id: _id.toHexString(), osuId, username, cookie };
};

/**
 * @function createTestAdmin
 * @param osuId {number} the admin's osu! id (default ADMIN_OSU_ID; ADMIN_OSU_IDS must list it)
 * @returns {Promise<TestUser>} as createTestUser, named admin<osuId>
 */
export const createTestAdmin = (osuId: number = ADMIN_OSU_ID): Promise<TestUser> =>
  createTestUser(osuId, `admin${osuId}`);
