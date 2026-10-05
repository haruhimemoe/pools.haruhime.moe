/**
 * @file tests/integration/lib/db-indexes.test.ts
 * @desc The indexes on better-auth's collections: one user per osu! id, one account per osu!
 *       link, one session per token, and sessions by user, built on connect and holding. Built
 *       over existing data with duplicates, the index that can't be unique is skipped and logged
 *       (the duplicate osu! ids and links named, a session token never), and the rest still
 *       build.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Mon Sep 28, 2026
 */

import { AUTH_INDEXES } from "@haruhimemoe/next-kit/auth";
import { ObjectId } from "mongodb";
import { afterEach, describe, expect, it, vi } from "vitest";
import { POOL_REVISIONS_COLLECTION } from "@/constants/db";
import { getDb } from "@/lib/db";
import { ensureIndexes } from "@/lib/db-indexes";
import { createTestUser } from "../../helpers/auth";
import { setupTestDb } from "../../helpers/db";

setupTestDb();
afterEach(async () => {
  vi.restoreAllMocks();
  // Files share one database: leave no duplicates and every index back for the next one.
  await Promise.all(
    ["user", "session", "account"].map((c) => getDb().collection(c).deleteMany({})),
  );
  await ensureIndexes(getDb());
});

const indexNamed = async (collection: string, name: string) =>
  (await getDb().collection(collection).indexes()).find((index) => index.name === name);

describe("auth indexes", () => {
  it("builds them on connect", async () => {
    expect(await indexNamed("user", AUTH_INDEXES.userOsuId)).toMatchObject({
      key: { osuId: 1 },
      unique: true,
    });
    expect(await indexNamed("account", AUTH_INDEXES.accountKey)).toMatchObject({
      key: { providerId: 1, accountId: 1 },
      unique: true,
    });
    expect(await indexNamed("session", AUTH_INDEXES.sessionToken)).toMatchObject({
      key: { token: 1 },
      unique: true,
    });
    const byUser = await indexNamed("session", AUTH_INDEXES.sessionUser);
    expect(byUser?.key).toEqual({ userId: 1 });
    expect(byUser?.unique).toBeUndefined();
  });

  it("holds: a second user, link or session token for the same key is refused", async () => {
    const user = await createTestUser(5);
    const db = getDb();
    await expect(db.collection("user").insertOne({ osuId: 5, name: "x" })).rejects.toMatchObject({
      code: 11000,
    });
    await expect(
      db.collection("account").insertOne({ providerId: "osu", accountId: "5", userId: user.id }),
    ).rejects.toMatchObject({ code: 11000 });
    const session = await db.collection("session").findOne({});
    await expect(
      db.collection("session").insertOne({ token: session?.token, userId: new ObjectId() }),
    ).rejects.toMatchObject({ code: 11000 });
  });
});

describe("pool_revisions indexes", () => {
  it("builds the unique docId+seq index on connect", async () => {
    const index = await getDb()
      .collection(POOL_REVISIONS_COLLECTION)
      .indexes()
      .then((indexes) => indexes.find((entry) => entry.key.docId === 1 && entry.key.seq === -1));
    expect(index).toMatchObject({ key: { docId: 1, seq: -1 }, unique: true });
  });
});

describe("auth indexes over existing duplicates", () => {
  it("skips and logs the index that can't be unique, and builds the rest", async () => {
    const db = getDb();
    for (const [collection, name] of [
      ["user", AUTH_INDEXES.userOsuId],
      ["session", AUTH_INDEXES.sessionToken],
      ["account", AUTH_INDEXES.accountKey],
    ] as const) {
      await db.collection(collection).dropIndex(name);
    }
    await db.collection("user").insertMany([
      { osuId: 7, name: "a" },
      { osuId: 7, name: "b" },
    ]);
    await db.collection("session").insertMany([
      { token: "secret-session-token", userId: new ObjectId() },
      { token: "secret-session-token", userId: new ObjectId() },
    ]);
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(ensureIndexes(db)).resolves.toBeUndefined();
    const lines = logged.mock.calls.map((call) => call.map(String).join(" "));
    expect(lines.find((line) => line.includes(AUTH_INDEXES.userOsuId))).toMatch(/osuId.*7/);
    expect(lines.some((line) => line.includes(AUTH_INDEXES.sessionToken))).toBe(true);
    expect(lines.join("\n")).not.toContain("secret-session-token");
    expect(await indexNamed("account", AUTH_INDEXES.accountKey)).toMatchObject({ unique: true });
    expect(await indexNamed("user", AUTH_INDEXES.userOsuId)).toBeUndefined();
  });
});
