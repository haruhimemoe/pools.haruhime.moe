/**
 * @file src/lib/db.ts
 * @desc One MongoClient per process, built on first use (never at import, so builds and pages
 *       without a database need no env). The database is always "pools", whatever the URI says.
 *       The first connect checks the user's privileges (src/lib/db-privileges.ts) and refuses to
 *       go on when they reach another database, then creates the raw indexes. better-auth reads
 *       getDb(); Mongoose models live on getModelConnection(), attached to the same client. State
 *       sits on globalThis so dev reloads don't leak clients; a failed connect is never cached.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import "server-only";
import { type Db, MongoClient } from "mongodb";
import mongoose, { type Connection } from "mongoose";
import { getDatabaseUri } from "@/env";
import { ensureIndexes } from "@/lib/db-indexes";
import { assertOnlyDatabase, readConnectionStatus } from "@/lib/db-privileges";

export const DB_NAME = "pools";

/** Two apps share one M0 cluster (500 connections), each over many Vercel instances. */
const MAX_POOL_SIZE = 5;
const SERVER_SELECTION_TIMEOUT_MS = 5000;

type MongoState = {
  client: MongoClient;
  base: Connection;
  models: Connection;
  ready: Promise<void> | null;
};

const store = globalThis as typeof globalThis & { __poolsMongo?: MongoState };

const createState = (): MongoState => {
  const client = new MongoClient(getDatabaseUri(), {
    maxPoolSize: MAX_POOL_SIZE,
    // Fail fast when the cluster is unreachable: a hung function is billed for every second.
    serverSelectionTimeoutMS: SERVER_SELECTION_TIMEOUT_MS,
  });
  const base = mongoose.createConnection();
  // Connection#useDb, not a React hook.
  const models = base.useDb(DB_NAME, { useCache: true });
  return { client, base, models, ready: null };
};

const state = (): MongoState => {
  store.__poolsMongo ??= createState();
  return store.__poolsMongo;
};

/**
 * @function getMongoClient
 * @returns {MongoClient} the shared client (connects lazily on first operation)
 */
export const getMongoClient = (): MongoClient => state().client;

/**
 * @function getDb
 * @returns {Db} the pools database on the shared client
 */
export const getDb = (): Db => state().client.db(DB_NAME);

/**
 * @function getModelConnection
 * @returns {Connection} the Mongoose connection models register on (usable after connectDb)
 */
export const getModelConnection = (): Connection => state().models;

/**
 * @function connectDb
 * @returns {Promise<void>} resolves once the client is connected, its privileges checked,
 *          Mongoose attached, and the raw indexes exist
 * @throws {DatabasePrivilegeError} when the user can reach another database
 */
export const connectDb = async (): Promise<void> => {
  const current = state();
  current.ready ??= current.client.connect().then(async () => {
    assertOnlyDatabase(await readConnectionStatus(current.client), DB_NAME);
    if (current.base.readyState === 0) current.base.setClient(current.client);
    await ensureIndexes(current.client.db(DB_NAME));
  });
  try {
    await current.ready;
  } catch (error) {
    current.ready = null;
    throw error;
  }
};

/**
 * @function connectedDb
 * @returns {Promise<Db>} the pools database once connectDb has resolved
 */
export const connectedDb = async (): Promise<Db> => {
  await connectDb();
  return getDb();
};

/**
 * @function closeDb
 * @returns {Promise<void>} closes the client and forgets it (tests, the import CLI)
 */
export const closeDb = async (): Promise<void> => {
  const current = store.__poolsMongo;
  if (!current) return;
  store.__poolsMongo = undefined;
  await current.client.close();
};
