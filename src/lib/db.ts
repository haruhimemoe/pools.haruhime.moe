/**
 * @file src/lib/db.ts
 * @desc pools' MongoDB, from next-kit's createMongo: one MongoClient per process, built on first
 *       use (never at import, so builds and pages without a database need no env), Mongoose on
 *       the same client, state on globalThis so dev reloads don't leak clients, and a failed
 *       connect never cached. The database is always "pools", whatever the URI says; the hub's
 *       "identity" database (users and sessions) sits on the same client, read-only for pools'
 *       Atlas user, so pools never builds an index or writes there. The first connect then checks the user's privileges (src/lib/db-privileges.ts) and refuses to go
 *       on when they reach another database, read on identity aside (unless POOLS_ALLOW_SHARED_DB_USER=true, which still
 *       needs readWrite on pools and warns), creates the raw indexes and fills in built pools'
 *       missing search fields (src/lib/built-backfill.ts).
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Tue Oct 6, 2026
 */

import "server-only";
import { createMongo } from "@haruhimemoe/next-kit/mongo";
import { getAllowSharedDbUser, getDatabaseUri } from "@/env";
import { backfillBuiltSearchFields } from "@/lib/built-backfill";
import { ensureIndexes } from "@/lib/db-indexes";
import { checkDatabasePrivileges, readConnectionStatus } from "@/lib/db-privileges";

/** The one database pools uses. */
export const DB_NAME = "pools";

/** The hub's identity database: pools reads sessions and users there, never writes. */
export const IDENTITY_DB_NAME = "identity";

const mongo = createMongo({
  dbName: DB_NAME,
  identityDbName: IDENTITY_DB_NAME,
  globalKey: "__poolsMongo",
  uri: getDatabaseUri,
  // pools' own work only: pools' Atlas user can't write identity, the hub owns its indexes.
  onConnect: async ({ db, client }) => {
    checkDatabasePrivileges(await readConnectionStatus(client), DB_NAME, getAllowSharedDbUser(), [
      IDENTITY_DB_NAME,
    ]);
    await ensureIndexes(db);
    await backfillBuiltSearchFields(db);
  },
});

/** The shared client (connects lazily on first operation). */
export const getMongoClient = mongo.getMongoClient;

/** The pools database on the shared client. */
export const getDb = mongo.getDb;

/** The hub's identity database on the shared client (read-only). */
export const getIdentityDb = mongo.getIdentityDb;

/** The Mongoose connection models register on (usable after connectDb). */
export const getModelConnection = mongo.getModelConnection;

/**
 * Connects once: privileges checked, Mongoose attached, raw indexes built and built pools'
 * search fields filled in. Rejects with DatabasePrivilegeError when the user can reach another
 * database (or, with POOLS_ALLOW_SHARED_DB_USER=true, can't write to pools).
 */
export const connectDb = mongo.connectDb;

/** The pools database once connectDb has resolved. */
export const connectedDb = mongo.connectedDb;

/** Closes the client and forgets it (tests, the import CLI). */
export const closeDb = mongo.closeDb;
