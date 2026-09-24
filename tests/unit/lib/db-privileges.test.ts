/**
 * @file tests/unit/lib/db-privileges.test.ts
 * @desc The start-up privilege check over connectionStatus answers shaped like Atlas's: a user
 *       with readWrite on "pools" passes (cluster-level and system collection resources don't
 *       count as another database); any other database, "any database" and anyResource are
 *       refused by name; an unauthenticated local server passes.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { describe, expect, it } from "vitest";
import {
  assertOnlyDatabase,
  type ConnectionStatus,
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
