/**
 * @file tests/unit/lib/db-privileges.test.ts
 * @desc The start-up privilege check over connectionStatus answers shaped like Atlas's: a user
 *       with readWrite on "pools" passes (cluster-level and system collection resources don't
 *       count as another database); any other database, "any database" and anyResource are
 *       refused by name; an unauthenticated local server passes; a signed-in user whose
 *       privileges aren't listed, and an answer that doesn't say who is signed in, are refused; a
 *       read-only database (identity) passes while it only reads.
 *       checkDatabasePrivileges adds the shared mode (POOLS_ALLOW_SHARED_DB_USER): other
 *       databases are allowed with one warning that names them (never a URI), but the user must
 *       still read and write every collection in "pools", and the answers strict mode can't read
 *       are still refused. Strict stays the default.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Tue Oct 6, 2026
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assertOnlyDatabase,
  type ConnectionStatus,
  canWriteDatabase,
  checkDatabasePrivileges,
  DatabasePrivilegeError,
  otherDatabases,
} from "@/lib/db-privileges";

const READ_WRITE = ["find", "insert", "update", "remove", "createIndex", "listCollections"];

type Privileges = NonNullable<
  NonNullable<ConnectionStatus["authInfo"]>["authenticatedUserPrivileges"]
>;

const atlasUser = (extra: Privileges = []): ConnectionStatus => ({
  authInfo: {
    authenticatedUsers: [{ user: "pools-app", db: "admin" }],
    authenticatedUserRoles: [{ role: "readWrite", db: "pools" }],
    authenticatedUserPrivileges: [
      { resource: { db: "pools", collection: "" }, actions: READ_WRITE },
      { resource: { db: "pools", collection: "system.js" }, actions: READ_WRITE },
      { resource: { cluster: true }, actions: ["listDatabases"] },
      ...extra,
    ],
  },
});

describe("otherDatabases", () => {
  it("finds none for readWrite on pools only (cluster and system collections included)", () => {
    expect(otherDatabases(atlasUser(), "pools")).toEqual([]);
  });

  it("names another database", () => {
    expect(
      otherDatabases(
        atlasUser([{ resource: { db: "packs", collection: "" }, actions: ["find"] }]),
        "pools",
      ),
    ).toEqual(["packs"]);
  });

  it("reads an empty db name and anyResource as every database", () => {
    expect(
      otherDatabases(
        atlasUser([{ resource: { db: "", collection: "" }, actions: ["find"] }]),
        "pools",
      ),
    ).toEqual(["*"]);
    expect(
      otherDatabases(atlasUser([{ resource: { anyResource: true }, actions: ["find"] }]), "pools"),
    ).toEqual(["*"]);
  });

  it("lets a read-only database through, and names it once it can write", () => {
    const reads = [
      { resource: { db: "identity", collection: "" }, actions: ["find", "listIndexes"] },
    ];
    expect(otherDatabases(atlasUser(reads), "pools", ["identity"])).toEqual([]);
    expect(otherDatabases(atlasUser(reads), "pools")).toEqual(["identity"]);
    const writes = [{ resource: { db: "identity", collection: "" }, actions: ["find", "insert"] }];
    expect(otherDatabases(atlasUser(writes), "pools", ["identity"])).toEqual(["identity"]);
  });

  it("names the read-only database in the strict fix", () => {
    expect(() =>
      assertOnlyDatabase(
        atlasUser([{ resource: { db: "packs", collection: "" }, actions: ["find"] }]),
        "pools",
        ["identity"],
      ),
    ).toThrow('Give it readWrite on "pools" and read on "identity" only.');
  });

  it("passes a local server without access control", () => {
    expect(
      otherDatabases(
        { authInfo: { authenticatedUsers: [], authenticatedUserPrivileges: [] } },
        "pools",
      ),
    ).toEqual([]);
    expect(otherDatabases({}, "pools")).toEqual([]);
  });
});

describe("assertOnlyDatabase", () => {
  it("passes the scoped user", () => {
    expect(() => assertOnlyDatabase(atlasUser(), "pools")).not.toThrow();
  });

  it("passes a local server without access control", () => {
    expect(() =>
      assertOnlyDatabase(
        {
          authInfo: {
            authenticatedUsers: [],
            authenticatedUserRoles: [],
            authenticatedUserPrivileges: [],
          },
        },
        "pools",
      ),
    ).not.toThrow();
  });

  it.each([
    ["no privilege list", { authenticatedUsers: [{ user: "pools-app", db: "admin" }] }],
    [
      "an empty privilege list",
      {
        authenticatedUsers: [{ user: "pools-app", db: "admin" }],
        authenticatedUserPrivileges: [],
      },
    ],
  ])("refuses a signed-in user with %s", (_case, authInfo) => {
    expect(() => assertOnlyDatabase({ authInfo }, "pools")).toThrow(DatabasePrivilegeError);
    expect(() => assertOnlyDatabase({ authInfo }, "pools")).toThrow(
      `The database server didn't list the user's privileges, so pools can't tell whether it reaches only "pools". Give it readWrite on "pools" only.`,
    );
  });

  it.each([
    ["no authInfo", {}],
    ["no user list", { authInfo: { authenticatedUserPrivileges: [] } }],
  ])("refuses an answer with %s", (_case, status) => {
    expect(() => assertOnlyDatabase(status, "pools")).toThrow(DatabasePrivilegeError);
  });

  it("refuses, naming each database and never a URI", () => {
    const status = atlasUser([
      { resource: { db: "packs", collection: "" }, actions: ["find"] },
      { resource: { db: "", collection: "" }, actions: ["find"] },
    ]);
    expect(() => assertOnlyDatabase(status, "pools")).toThrow(DatabasePrivilegeError);
    expect(() => assertOnlyDatabase(status, "pools")).toThrow(
      'The database user can reach every database, "packs", not only "pools". Give it readWrite on "pools" only.',
    );
  });
});

const PACKS_READ_WRITE: Privileges = [
  { resource: { db: "packs", collection: "" }, actions: READ_WRITE },
];

/** A user that can reach only "packs", or read "pools" without writing to it. */
const withoutPoolsWrite = (poolsActions: string[]): ConnectionStatus => ({
  authInfo: {
    authenticatedUsers: [{ user: "packs-app", db: "admin" }],
    authenticatedUserPrivileges: [
      ...PACKS_READ_WRITE,
      ...(poolsActions.length > 0
        ? [{ resource: { db: "pools", collection: "" }, actions: poolsActions }]
        : []),
    ],
  },
});

describe("canWriteDatabase", () => {
  it("is true for readWrite on the database, and for readWrite on every database", () => {
    expect(canWriteDatabase(atlasUser(), "pools")).toBe(true);
    const anyDatabase: ConnectionStatus = {
      authInfo: {
        authenticatedUsers: [{ user: "app", db: "admin" }],
        authenticatedUserPrivileges: [
          { resource: { db: "", collection: "" }, actions: READ_WRITE },
        ],
      },
    };
    expect(canWriteDatabase(anyDatabase, "pools")).toBe(true);
  });

  it("adds up actions from several privileges on the database", () => {
    const split: ConnectionStatus = {
      authInfo: {
        authenticatedUsers: [{ user: "app", db: "admin" }],
        authenticatedUserPrivileges: [
          { resource: { db: "pools", collection: "" }, actions: ["find", "insert"] },
          {
            resource: { db: "pools", collection: "" },
            actions: ["update", "remove", "createIndex"],
          },
        ],
      },
    };
    expect(canWriteDatabase(split, "pools")).toBe(true);
  });

  it("is false for read only, another database, or one collection", () => {
    expect(canWriteDatabase(withoutPoolsWrite(["find", "listCollections"]), "pools")).toBe(false);
    expect(canWriteDatabase(withoutPoolsWrite([]), "pools")).toBe(false);
    const oneCollection: ConnectionStatus = {
      authInfo: {
        authenticatedUsers: [{ user: "app", db: "admin" }],
        authenticatedUserPrivileges: [
          { resource: { db: "pools", collection: "maps" }, actions: READ_WRITE },
        ],
      },
    };
    expect(canWriteDatabase(oneCollection, "pools")).toBe(false);
  });
});

describe("checkDatabasePrivileges", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const sharedUser = () => atlasUser(PACKS_READ_WRITE);

  it("is strict by default: a user shared with packs is refused, naming packs", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() => checkDatabasePrivileges(sharedUser(), "pools", false)).toThrow(
      'The database user can reach "packs", not only "pools". Give it readWrite on "pools" only.',
    );
    expect(warn).not.toHaveBeenCalled();
  });

  it("passes the scoped user in both modes without a warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() => checkDatabasePrivileges(atlasUser(), "pools", false)).not.toThrow();
    expect(() => checkDatabasePrivileges(atlasUser(), "pools", true)).not.toThrow();
    expect(warn).not.toHaveBeenCalled();
  });

  it("allows a shared user when shared, with one warning naming the other databases", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() => checkDatabasePrivileges(sharedUser(), "pools", true)).not.toThrow();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      'POOLS_ALLOW_SHARED_DB_USER is on, so pools runs on a database user that can also reach "packs". A bug in pools or a leaked credential could change data there.',
    );
  });

  it("names every database for a user with readWrite on any database", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const anyDatabase: ConnectionStatus = {
      authInfo: {
        authenticatedUsers: [{ user: "app", db: "admin" }],
        authenticatedUserPrivileges: [
          { resource: { db: "", collection: "" }, actions: READ_WRITE },
          { resource: { db: "packs", collection: "" }, actions: READ_WRITE },
        ],
      },
    };
    expect(() => checkDatabasePrivileges(anyDatabase, "pools", true)).not.toThrow();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain('also reach every database, "packs".');
  });

  it.each([
    ["read only on pools", ["find", "listCollections"]],
    ["nothing on pools", []],
  ])("still refuses a shared user with %s", (_case, poolsActions) => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() => checkDatabasePrivileges(withoutPoolsWrite(poolsActions), "pools", true)).toThrow(
      `The database user can't read and write every collection in "pools". Give it readWrite on "pools".`,
    );
    expect(warn).not.toHaveBeenCalled();
  });

  it.each([
    ["no authInfo", {}],
    ["no user list", { authInfo: { authenticatedUserPrivileges: PACKS_READ_WRITE } }],
  ])("still refuses an answer with %s", (_case, status) => {
    expect(() => checkDatabasePrivileges(status, "pools", true)).toThrow(DatabasePrivilegeError);
    expect(() => checkDatabasePrivileges(status, "pools", true)).toThrow(
      `The database server didn't say which user is signed in, so pools can't tell whether it can write to "pools". Give it readWrite on "pools".`,
    );
  });

  it("still refuses a signed-in user whose privileges aren't listed", () => {
    const status = { authInfo: { authenticatedUsers: [{ user: "packs-app", db: "admin" }] } };
    expect(() => checkDatabasePrivileges(status, "pools", true)).toThrow(
      `The database server didn't list the user's privileges, so pools can't tell whether it can write to "pools". Give it readWrite on "pools".`,
    );
  });

  it("passes a local server without access control when shared, without a warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const local = { authInfo: { authenticatedUsers: [], authenticatedUserPrivileges: [] } };
    expect(() => checkDatabasePrivileges(local, "pools", true)).not.toThrow();
    expect(warn).not.toHaveBeenCalled();
  });
});
