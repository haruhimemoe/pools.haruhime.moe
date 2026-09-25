/**
 * @file src/lib/db-privileges.ts
 * @desc The start-up privilege check: pools reads its database user's privileges
 *       (connectionStatus with showPrivileges) and refuses to run when they reach any database
 *       but its own. Cluster-level resources (like listDatabases) aren't a database and don't
 *       count; an empty db name and anyResource mean every database. A local server without
 *       access control (no user signed in) reports no privileges and passes. It fails closed: an
 *       answer that doesn't say who is signed in, or a signed-in user with no privileges listed,
 *       is refused, since pools can't tell what that user reaches. The error names databases,
 *       never the connection string.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
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

/**
 * @function assertOnlyDatabase
 * @param status {ConnectionStatus} what the server said
 * @param dbName {string} the one database the user may reach
 * @returns {void} nothing when the user reaches no other database
 * @throws {DatabasePrivilegeError} naming each other database it reaches, or when the answer
 *         doesn't say who is signed in or lists no privileges for a signed-in user
 */
export const assertOnlyDatabase = (status: ConnectionStatus, dbName: string): void => {
  const users = status.authInfo?.authenticatedUsers;
  if (!Array.isArray(users)) {
    throw new DatabasePrivilegeError(
      `The database server didn't say which user is signed in, so pools can't tell whether it reaches only "${dbName}". Give it readWrite on "${dbName}" only.`,
    );
  }
  const privileges = status.authInfo?.authenticatedUserPrivileges;
  if (users.length > 0 && (!Array.isArray(privileges) || privileges.length === 0)) {
    throw new DatabasePrivilegeError(
      `The database server didn't list the user's privileges, so pools can't tell whether it reaches only "${dbName}". Give it readWrite on "${dbName}" only.`,
    );
  }
  const others = otherDatabases(status, dbName);
  if (others.length === 0) return;
  const names = others.map((name) => (name === EVERY_DATABASE ? "every database" : `"${name}"`));
  throw new DatabasePrivilegeError(
    `The database user can reach ${names.join(", ")}, not only "${dbName}". Give it readWrite on "${dbName}" only.`,
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
