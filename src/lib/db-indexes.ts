/**
 * @file src/lib/db-indexes.ts
 * @desc Indexes on collections Mongoose doesn't manage: the session TTL (MongoDB deletes a
 *       sign-in session about a minute after it expires, as the privacy page says), the TTL
 *       on rate-limit counters, the 24-hour TTL on cached beatmapset facts and their
 *       difficulty-id index, pack_cleanup's due time, and better-auth's: one user per osu! id, one account per osu!
 *       link, one session per token (every signed-in request looks it up) and sessions by user.
 *       Each auth index builds on its own over whatever data is there: one that can't be unique
 *       because the data has duplicates is skipped and logged (the duplicate osu! ids and links
 *       named, a session token never, since it's a credential), and the rest still build. Pool,
 *       map and import indexes live on their Mongoose schemas (src/models). createIndex is a
 *       no-op when the index already exists.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Sun Sep 27, 2026
 */

import "server-only";
import type { Db, IndexSpecification } from "mongodb";
import {
  SET_FACTS_BEATMAPS_INDEX,
  SET_FACTS_TTL_INDEX,
  SET_FACTS_TTL_SECONDS,
} from "@/constants/compliance";
import {
  AUTH_INDEXES,
  PACK_CLEANUP_COLLECTION,
  RATE_LIMITS_COLLECTION,
  SESSION_TTL_INDEX,
  SET_FACTS_COLLECTION,
} from "@/constants/db";

type AuthIndex = {
  collection: "user" | "account" | "session";
  key: IndexSpecification & Record<string, 1>;
  name: string;
  unique: boolean;
  /** The key is a credential: never log its values. */
  secret: boolean;
};

const AUTH_INDEX_LIST: readonly AuthIndex[] = [
  {
    collection: "user",
    key: { osuId: 1 },
    name: AUTH_INDEXES.userOsuId,
    unique: true,
    secret: false,
  },
  {
    collection: "account",
    key: { providerId: 1, accountId: 1 },
    name: AUTH_INDEXES.accountKey,
    unique: true,
    secret: false,
  },
  {
    collection: "session",
    key: { token: 1 },
    name: AUTH_INDEXES.sessionToken,
    unique: true,
    secret: true,
  },
  {
    collection: "session",
    key: { userId: 1 },
    name: AUTH_INDEXES.sessionUser,
    unique: false,
    secret: false,
  },
];

const isDuplicateKey = (error: unknown): boolean =>
  typeof error === "object" && error !== null && "code" in error && error.code === 11000;

/** Up to 10 key values held by more than one row, with how many rows hold each. */
const duplicatesOf = async (db: Db, index: AuthIndex): Promise<unknown[]> => {
  const fields = Object.keys(index.key);
  const group = Object.fromEntries(fields.map((field) => [field, `$${field}`]));
  return db
    .collection(index.collection)
    .aggregate([
      { $group: { _id: group, rows: { $sum: 1 } } },
      { $match: { rows: { $gt: 1 } } },
      { $limit: 10 },
    ])
    .toArray();
};

const buildAuthIndex = async (db: Db, index: AuthIndex): Promise<void> => {
  try {
    await db
      .collection(index.collection)
      .createIndex(index.key, { name: index.name, ...(index.unique ? { unique: true } : {}) });
  } catch (error) {
    const fields = Object.keys(index.key).join(", ");
    if (!isDuplicateKey(error)) {
      console.error(`db: couldn't create ${index.name}`, index.secret ? "" : error);
      return;
    }
    const found = index.secret ? [] : await duplicatesOf(db, index).catch(() => []);
    console.error(
      `db: ${index.collection} has rows sharing ${fields}, so ${index.name} wasn't built. ` +
        "Merge or remove the extra rows; it builds on the next start.",
      index.secret ? "" : JSON.stringify(found),
    );
  }
};

/**
 * @function ensureAuthIndexes
 * @param db {Db} the pools database
 * @returns {Promise<void>} each of better-auth's indexes built, or skipped and logged (never
 *          thrown): duplicates in existing data must not take sign-in down
 */
export const ensureAuthIndexes = async (db: Db): Promise<void> => {
  await Promise.all(AUTH_INDEX_LIST.map((index) => buildAuthIndex(db, index)));
};

/**
 * @function ensureIndexes
 * @param db {Db} the pools database
 * @returns {Promise<void>} resolves even when an index can't be created (logged, never thrown):
 *          a missing TTL index must not take the site down
 */
export const ensureIndexes = async (db: Db): Promise<void> => {
  try {
    await Promise.all([
      db
        .collection("session")
        .createIndex({ expiresAt: 1 }, { name: SESSION_TTL_INDEX, expireAfterSeconds: 0 }),
      db
        .collection(RATE_LIMITS_COLLECTION)
        .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      db
        .collection(SET_FACTS_COLLECTION)
        .createIndex(
          { fetchedAt: 1 },
          { name: SET_FACTS_TTL_INDEX, expireAfterSeconds: SET_FACTS_TTL_SECONDS },
        ),
      db
        .collection(SET_FACTS_COLLECTION)
        .createIndex({ beatmapIds: 1 }, { name: SET_FACTS_BEATMAPS_INDEX }),
      db.collection(PACK_CLEANUP_COLLECTION).createIndex({ nextAt: 1 }),
    ]);
  } catch (error) {
    console.error("db: couldn't create indexes", error);
  }
  await ensureAuthIndexes(db);
};
