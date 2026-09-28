/**
 * @file tests/integration/lib/db.test.ts
 * @desc connectDb against the in-memory server: the "pools" database whatever the URI says, the
 *       TTL indexes for sessions and rate-limit counters, the setFacts TTL and difficulty-id
 *       indexes, and the privilege check refusing a user that can reach another database (a
 *       failure isn't cached: the next call tries again). POOLS_ALLOW_SHARED_DB_USER=true lets
 *       that user through with one warning naming the databases (never the URI), but still
 *       refuses one that can't write to "pools".
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Mon Sep 28, 2026
 */

import { AUTH_INDEXES } from "@haruhimemoe/next-kit/auth";
import { Db, type Document } from "mongodb";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RATE_LIMITS_COLLECTION } from "@/constants/db";
import { closeDb, connectDb, getDb } from "@/lib/db";
import { type ConnectionStatus, DatabasePrivilegeError } from "@/lib/db-privileges";

afterEach(async () => {
  vi.restoreAllMocks();
  // Only this variable: unstubAllEnvs would also drop the MONGODB_URI the setup file stubbed.
  vi.stubEnv("POOLS_ALLOW_SHARED_DB_USER", undefined);
  await closeDb();
});

const READ_WRITE = ["find", "insert", "update", "remove", "createIndex", "listCollections"];

/** Answers connectionStatus with authInfo, and runs every other command for real. */
const answerConnectionStatus = (authInfo: ConnectionStatus["authInfo"]) => {
  const real = Db.prototype.command;
  vi.spyOn(Db.prototype, "command").mockImplementation(function (
    this: Db,
    command: Document,
    options?: Parameters<Db["command"]>[1],
  ) {
    if ("connectionStatus" in command) return Promise.resolve({ ok: 1, authInfo });
    return real.call(this, command, options);
  } as Db["command"]);
};

const SHARED_WITH_PACKS: ConnectionStatus["authInfo"] = {
  authenticatedUsers: [{ user: "packs-app", db: "admin" }],
  authenticatedUserPrivileges: [
    { resource: { db: "packs", collection: "" }, actions: READ_WRITE },
    { resource: { db: "pools", collection: "" }, actions: READ_WRITE },
  ],
};

describe("connectDb", () => {
  it("uses the pools database", async () => {
    await connectDb();
    expect(getDb().databaseName).toBe("pools");
  });

  it("creates the TTL indexes for sessions and rate-limit counters", async () => {
    await connectDb();
    const session = await getDb().collection("session").indexes();
    expect(session.find((index) => index.name === AUTH_INDEXES.sessionTtl)).toMatchObject({
      key: { expiresAt: 1 },
      expireAfterSeconds: 0,
    });
    const counters = await getDb().collection(RATE_LIMITS_COLLECTION).indexes();
    expect(counters.find((index) => index.key.expiresAt === 1)).toMatchObject({
      expireAfterSeconds: 0,
    });
  });

  it("creates the setFacts TTL and difficulty-id indexes", async () => {
    await connectDb();
    const names = (await getDb().collection("setFacts").indexes()).map((index) => index.name);
    expect(names).toEqual(expect.arrayContaining(["setFacts_fetchedAt_ttl", "beatmapIds_1"]));
  });

  it("refuses a user that can reach another database, then tries again next time", async () => {
    const real = Db.prototype.command;
    vi.spyOn(Db.prototype, "command").mockImplementation(function (
      this: Db,
      command: Document,
      options?: Parameters<Db["command"]>[1],
    ) {
      if ("connectionStatus" in command) {
        return Promise.resolve({
          ok: 1,
          authInfo: {
            authenticatedUsers: [{ user: "pools-app", db: "admin" }],
            authenticatedUserPrivileges: [
              { resource: { db: "packs", collection: "" }, actions: ["find"] },
            ],
          },
        });
      }
      return real.call(this, command, options);
    } as Db["command"]);
    await expect(connectDb()).rejects.toThrow(DatabasePrivilegeError);
    await expect(connectDb()).rejects.toThrow('"packs"');
    vi.restoreAllMocks();
    await expect(connectDb()).resolves.toBeUndefined();
  });
});

describe("connectDb with POOLS_ALLOW_SHARED_DB_USER", () => {
  it("refuses a user shared with packs while the variable is unset", async () => {
    answerConnectionStatus(SHARED_WITH_PACKS);
    await expect(connectDb()).rejects.toThrow('"packs"');
  });

  it.each(["1", "yes", "TRUE"])("stays strict for %j", async (value) => {
    vi.stubEnv("POOLS_ALLOW_SHARED_DB_USER", value);
    answerConnectionStatus(SHARED_WITH_PACKS);
    await expect(connectDb()).rejects.toThrow(DatabasePrivilegeError);
  });

  it("connects a shared user on true and warns once, naming packs and never the URI", async () => {
    vi.stubEnv("POOLS_ALLOW_SHARED_DB_USER", "true");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    answerConnectionStatus(SHARED_WITH_PACKS);
    await connectDb();
    await connectDb();
    expect(getDb().databaseName).toBe("pools");
    expect(warn).toHaveBeenCalledTimes(1);
    const message = String(warn.mock.calls[0]?.[0]);
    expect(message).toContain('"packs"');
    expect(message).not.toContain(process.env.MONGODB_URI ?? "mongodb://");
    expect(message).not.toContain("mongodb");
  });

  it("still refuses a shared user that can't write to pools", async () => {
    vi.stubEnv("POOLS_ALLOW_SHARED_DB_USER", "true");
    answerConnectionStatus({
      authenticatedUsers: [{ user: "packs-app", db: "admin" }],
      authenticatedUserPrivileges: [
        { resource: { db: "packs", collection: "" }, actions: READ_WRITE },
        { resource: { db: "pools", collection: "" }, actions: ["find"] },
      ],
    });
    await expect(connectDb()).rejects.toThrow(
      `The database user can't read and write every collection in "pools".`,
    );
  });

  it("still refuses an answer without authInfo", async () => {
    vi.stubEnv("POOLS_ALLOW_SHARED_DB_USER", "true");
    answerConnectionStatus(undefined);
    await expect(connectDb()).rejects.toThrow(DatabasePrivilegeError);
  });
});
