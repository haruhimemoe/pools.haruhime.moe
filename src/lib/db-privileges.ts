/**
 * @file src/lib/db-privileges.ts
 * @desc The start-up privilege check: pools reads its database user's privileges
 *       (connectionStatus with showPrivileges) and refuses to run when they reach any database
 *       but its own. Cluster-level resources (like listDatabases) aren't a database and don't
 *       count; an empty db name and anyResource mean every database. A local server without
 *       access control (no user signed in) reports no privileges and passes. It fails closed: an
 *       answer that doesn't say who is signed in, or a signed-in user with no privileges listed,
 *       is refused, since pools can't tell what that user reaches. The error names databases,
 *       never the connection string. Shared mode (POOLS_ALLOW_SHARED_DB_USER=true) allows other
 *       databases with one warning naming them, but still refuses those answers and a user that
 *       can't read and write every collection in pools.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Mon Sep 28, 2026
 */

import "server-only";
import type { MongoClient } from "mongodb";

type Privilege = {
  resource?: { db?: string; collection?: string; cluster?: boolean; anyResource?: boolean };
  actions?: string[];
};

/** The parts of a connectionStatus answer the check reads. */
export type ConnectionStatus = {
  authInfo?: {
    authenticatedUsers?: { user: string; db: string }[];
    authenticatedUserRoles?: { role: string; db: string }[];
    authenticatedUserPrivileges?: Privilege[];
  };
};

/** Thrown when the database user can reach more than pools, or can't write to it. */
export class DatabasePrivilegeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DatabasePrivilegeError";
  }
}

const EVERY_DATABASE = "*";

/**
 * @function otherDatabases
 * @param status {ConnectionStatus} what the server said
 * @param dbName {string} the one database the user may reach
 * @returns {string[]} every other database its privileges reach, sorted ("*" for every database)
 */
export const otherDatabases = (status: ConnectionStatus, dbName: string): string[] => {
  const found = new Set<string>();
  for (const { resource } of status.authInfo?.authenticatedUserPrivileges ?? []) {
    if (!resource) continue;
    if (resource.anyResource === true) found.add(EVERY_DATABASE);
    else if (typeof resource.db === "string" && resource.db !== dbName) {
      found.add(resource.db === "" ? EVERY_DATABASE : resource.db);
    }
  }
  return [...found].sort();
};

const describeDatabases = (names: string[]): string =>
  names.map((name) => (name === EVERY_DATABASE ? "every database" : `"${name}"`)).join(", ");

/**
 * Refuses an answer that doesn't say who is signed in, or a signed-in user with no privileges
 * listed: pools can't tell what that user reaches. `ask` and `fix` finish the message.
 */
const assertReadable = (status: ConnectionStatus, ask: string, fix: string): void => {
  const users = status.authInfo?.authenticatedUsers;
  if (!Array.isArray(users)) {
    throw new DatabasePrivilegeError(
      `The database server didn't say which user is signed in, so pools can't tell ${ask}. ${fix}`,
    );
  }
  const privileges = status.authInfo?.authenticatedUserPrivileges;
  if (users.length > 0 && (!Array.isArray(privileges) || privileges.length === 0)) {
    throw new DatabasePrivilegeError(
      `The database server didn't list the user's privileges, so pools can't tell ${ask}. ${fix}`,
    );
  }
};

/**
 * @function assertOnlyDatabase
 * @param status {ConnectionStatus} what the server said
 * @param dbName {string} the one database the user may reach
 * @returns {void} nothing when the user reaches no other database
 * @throws {DatabasePrivilegeError} naming each other database it reaches, or when the answer
 *         doesn't say who is signed in or lists no privileges for a signed-in user
 */
export const assertOnlyDatabase = (status: ConnectionStatus, dbName: string): void => {
  const fix = `Give it readWrite on "${dbName}" only.`;
  assertReadable(status, `whether it reaches only "${dbName}"`, fix);
  const others = otherDatabases(status, dbName);
  if (others.length === 0) return;
  throw new DatabasePrivilegeError(
    `The database user can reach ${describeDatabases(others)}, not only "${dbName}". ${fix}`,
  );
};

/** The readWrite actions pools uses on every collection of its database. */
const WRITE_ACTIONS = ["find", "insert", "update", "remove", "createIndex"] as const;

/**
 * @function canWriteDatabase
 * @param status {ConnectionStatus} what the server said
 * @param dbName {string} the database pools writes to
 * @returns {boolean} true when the privileges on the whole database (on dbName itself, on every
 *          database, or anyResource; a single collection doesn't count) add up to find, insert,
 *          update, remove and createIndex
 */
export const canWriteDatabase = (status: ConnectionStatus, dbName: string): boolean => {
  const granted = new Set<string>();
  for (const { resource, actions } of status.authInfo?.authenticatedUserPrivileges ?? []) {
    if (!resource) continue;
    const whole =
      resource.anyResource === true ||
      (resource.collection === "" && (resource.db === dbName || resource.db === ""));
    if (whole) for (const action of actions ?? []) granted.add(action);
  }
  return WRITE_ACTIONS.every((action) => granted.has(action));
};

/**
 * @function checkDatabasePrivileges
 * @param status {ConnectionStatus} what the server said
 * @param dbName {string} the database pools uses
 * @param shared {boolean} POOLS_ALLOW_SHARED_DB_USER: false (the default) refuses any other
 *        database; true allows them but still needs readWrite on dbName
 * @returns {void} nothing when the user passes; in shared mode it logs one console.warn naming
 *          the other databases the user reaches (names only), when there are any
 * @throws {DatabasePrivilegeError} when the user fails the check for its mode, or the answer
 *         doesn't say who is signed in or lists no privileges for a signed-in user
 */
export const checkDatabasePrivileges = (
  status: ConnectionStatus,
  dbName: string,
  shared: boolean,
): void => {
  if (!shared) {
    assertOnlyDatabase(status, dbName);
    return;
  }
  const fix = `Give it readWrite on "${dbName}".`;
  assertReadable(status, `whether it can write to "${dbName}"`, fix);
  const signedIn = (status.authInfo?.authenticatedUsers?.length ?? 0) > 0;
  if (signedIn && !canWriteDatabase(status, dbName)) {
    throw new DatabasePrivilegeError(
      `The database user can't read and write every collection in "${dbName}". ${fix}`,
    );
  }
  const others = otherDatabases(status, dbName);
  if (others.length === 0) return;
  console.warn(
    `POOLS_ALLOW_SHARED_DB_USER is on, so pools runs on a database user that can also reach ${describeDatabases(others)}. A bug in pools or a leaked credential could change data there.`,
  );
};

/**
 * @function readConnectionStatus
 * @param client {MongoClient} a connected client
 * @returns {Promise<ConnectionStatus>} connectionStatus with showPrivileges
 */
export const readConnectionStatus = async (client: MongoClient): Promise<ConnectionStatus> =>
  (await client
    .db("admin")
    .command({ connectionStatus: 1, showPrivileges: true })) as ConnectionStatus;
