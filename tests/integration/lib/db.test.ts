/**
 * @file tests/integration/lib/db.test.ts
 * @desc connectDb against the in-memory server: the "pools" database whatever the URI says, the
 *       TTL indexes for sessions and rate-limit counters, and the privilege check refusing a user
 *       that can reach another database (a failure isn't cached: the next call tries again).
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { Db, type Document } from "mongodb";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RATE_LIMITS_COLLECTION, SESSION_TTL_INDEX } from "@/constants/db";
import { closeDb, connectDb, getDb } from "@/lib/db";
import { DatabasePrivilegeError } from "@/lib/db-privileges";

afterEach(async () => {
  vi.restoreAllMocks();
  await closeDb();
});

describe("connectDb", () => {
  it("uses the pools database", async () => {
    await connectDb();
    expect(getDb().databaseName).toBe("pools");
  });

  it("creates the TTL indexes for sessions and rate-limit counters", async () => {
    await connectDb();
    const session = await getDb().collection("session").indexes();
    expect(session.find((index) => index.name === SESSION_TTL_INDEX)).toMatchObject({
      key: { expiresAt: 1 },
      expireAfterSeconds: 0,
    });
    const counters = await getDb().collection(RATE_LIMITS_COLLECTION).indexes();
    expect(counters.find((index) => index.key.expiresAt === 1)).toMatchObject({
      expireAfterSeconds: 0,
    });
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
