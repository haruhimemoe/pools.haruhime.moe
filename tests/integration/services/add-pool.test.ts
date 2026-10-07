/**
 * @file tests/integration/services/add-pool.test.ts
 * @desc Adding a host or community pool by hand, against the database, a stand-in mirror and a
 *       stand-in packs (msw): a new pool gets "<kind>-<generated id>", its credit (a pool with no
 *       link round-trips with the key left out), a name from tournament, year and round, the
 *       typed fields as edits, badged, search keys, blank map rows filled from the mirror at once
 *       (misses stay blank), stats, usage, and its pack. Maps identical to a stored otdb pool join
 *       it (name, notes, edits, badged and hidden kept; the form's fields dropped); maps identical
 *       to a superseded pool revive it. Two merges planned from the same snapshot keep both
 *       sources; a create that loses the race becomes a merge; a sender already credited with the
 *       same link adds nothing and the answer says so. A generated id skips one already used.
 *       Maps that can't be read (a /p/ link, a damaged key, a slot twice, 65 maps) come back as a
 *       maps error and nothing is written. A packs /k link keeps the pack's custom slot. No packs
 *       token saves the pool and says the pack wasn't sent.
 * @author David @dvhsh (https://dvh.sh)
 * @created Fri Sep 25, 2026
 * @modified Sat Sep 26, 2026
 */

import { HINAI_BATCH_URL } from "@haruhimemoe/mirror/testing";
import { setupMsw } from "@haruhimemoe/next-kit/testing";
import { encodePackKey } from "@haruhimemoe/pool";
import { revalidatePath } from "next/cache";
import { describe, expect, it } from "vitest";
import { mapsCollection } from "@/models/Map";
import { poolsCollection } from "@/models/Pool";
import type { AddPoolBody } from "@/schemas/admin";
import { parseStoredPool } from "@/schemas/pool";
import { addPool } from "@/services/add-pool";
import { loadExistingPools } from "@/services/import";
import { setupTestDb } from "../../helpers/db";
import { mirrorHandler, mirrorRow } from "../../helpers/hinai-server";
import {
  createdAnswer,
  type PutCall,
  packsPutHandler,
  TEST_SERVICE,
} from "../../helpers/packs-server";
import { makeMap, makePool, T0 } from "../../helpers/records";

setupTestDb();

const SEED = {
  setId: 39804,
  artist: "xi",
  title: "FREEDOM DiVE",
  setHost: "Nakagawa-Kanon",
  version: "FOUR DIMENSIONS",
  ar: 9,
  od: 8,
  cs: 4,
  hp: 6,
  length: 258,
  bpm: 222.22,
};

/** The mirror knows 129891 and 75, not 2000001. */
const MIRROR = new Map([
  [129891, mirrorRow(129891, SEED, 7.81)],
  [75, mirrorRow(75, { ...SEED, setId: 1, title: "Disco Prince", version: "Normal" }, 2.2)],
]);

const puts: PutCall[] = [];
const server = setupMsw(
  mirrorHandler(MIRROR),
  packsPutHandler((id) => createdAnswer(id), puts),
);

const deps = { packsService: () => TEST_SERVICE, now: () => T0, sleep: async () => {} };

const BODY: AddPoolBody = {
  kind: "host",
  creditName: "Spring Cup hosts",
  creditUrl: null,
  tournament: "Spring Cup",
  round: "Grand Finals",
  year: 2026,
  badged: true,
  notes: "HD optional in FM.",
  maps: "NM1 129891\nHD1 75\nHDHR1 2000001",
};

const added = async (body: Partial<AddPoolBody> = {}, more = {}) => {
  const result = await addPool({ ...BODY, ...body }, { ...deps, ...more });
  if (!result.ok) throw new Error(JSON.stringify(result.fields));
  return result.answer;
};

describe("addPool", () => {
  it("creates a host pool with its credit, name, edits, maps, stats, usage and pack", async () => {
    puts.length = 0;
    const answer = await added();
    expect(answer).toMatchObject({
      outcome: "created",
      revived: false,
      pool: { name: "Spring Cup 2026 Grand Finals", hidden: false },
      maps: { added: 3, asked: 3, filled: 2, missing: 1, error: null },
      sync: { status: "sent", state: "created", error: null },
    });
    expect(answer.pool.id).toMatch(/^host-[a-z][0-9a-z]{7}$/);

    const raw = await (await poolsCollection()).findOne({ _id: answer.pool.id });
    const pool = parseStoredPool(raw);
    expect(pool).toMatchObject({
      name: "Spring Cup 2026 Grand Finals",
      tournament: "Spring Cup",
      round: "Grand Finals",
      year: 2026,
      badged: true,
      hidden: false,
      visible: true,
      notes: "HD optional in FM.",
      stats: { count: 3, srMin: 2.2, srMax: 7.81, complete: false },
      pack: { state: "created", listed: true },
    });
    expect(pool?.sources).toEqual([
      {
        kind: "host",
        id: answer.pool.id.slice("host-".length),
        credit: { name: "Spring Cup hosts" },
        importedAt: T0,
      },
    ]);
    // No link: the key is left out, never stored as null.
    expect(raw?.sources[0]).not.toHaveProperty("credit.url");
    expect(pool?.searchText).toContain("spring cup");
    expect(puts.map((call) => call.id)).toEqual([answer.pool.id]);

    const maps = await mapsCollection();
    expect(await maps.findOne({ _id: 129891 })).toMatchObject({
      metaSource: "mirror",
      stars: 7.81,
      usage: { count: 1, lastYear: 2026, shown: true },
    });
    expect(await maps.findOne({ _id: 2000001 })).toMatchObject({
      metaSource: "none",
      title: null,
      stars: null,
      usage: { count: 1 },
    });
    expect(revalidatePath).toHaveBeenCalledWith(`/pools/${answer.pool.id}`);
  });

  it("stores a community credit's https link", async () => {
    const answer = await added({
      kind: "community",
      creditName: "peppy",
      creditUrl: "https://osu.ppy.sh/users/2",
    });
    expect(answer.pool.id).toMatch(/^community-/);
    const pool = parseStoredPool(await (await poolsCollection()).findOne({ _id: answer.pool.id }));
    expect(pool?.sources[0]).toMatchObject({
      kind: "community",
      credit: { name: "peppy", url: "https://osu.ppy.sh/users/2" },
    });
  });

  it("joins a stored otdb pool with the same maps, keeping everything but the sources", async () => {
    const owc = makePool({
      _id: "otdb-657",
      name: "osu! World Cup 2023 Grand Finals",
      notes: "From otdb.",
      edited: { year: 2023 },
      badged: false,
      slots: [
        { mod: "NM", index: 1, beatmapId: 129891 },
        { mod: "HD", index: 1, beatmapId: 75 },
      ],
    });
    await (await poolsCollection()).insertOne(owc);
    await (await mapsCollection()).insertMany([makeMap({ _id: 129891 }), makeMap({ _id: 75 })]);
    const answer = await added({ maps: "HD1 75\nNM1 129891", badged: true, round: "Finals" });
    expect(answer).toMatchObject({
      outcome: "merged",
      revived: false,
      pool: { id: "otdb-657", name: "osu! World Cup 2023 Grand Finals" },
      maps: { added: 0 },
    });
    const stored = parseStoredPool(await (await poolsCollection()).findOne({ _id: "otdb-657" }));
    expect(stored).toMatchObject({
      name: owc.name,
      notes: "From otdb.",
      edited: { year: 2023 },
      badged: false,
      round: "Grand Finals",
    });
    expect(stored?.sources.map(({ kind }) => kind)).toEqual(["otdb", "host"]);
    expect(await (await poolsCollection()).countDocuments()).toBe(1);
  });

  it("revives a superseded pool with the same maps", async () => {
    const old = makePool({
      _id: "otdb-71",
      name: "United States Cup 2017 Quarter Finals",
      sources: [],
      supersededBy: "otdb-71-2",
      slots: [{ mod: "NM", index: 1, beatmapId: 129891 }],
    });
    await (await poolsCollection()).insertOne(old);
    const answer = await added({ maps: "NM1 129891" });
    expect(answer).toMatchObject({
      outcome: "merged",
      revived: true,
      pool: { id: "otdb-71", name: "United States Cup 2017 Quarter Finals" },
    });
    const stored = parseStoredPool(await (await poolsCollection()).findOne({ _id: "otdb-71" }));
    expect(stored).toMatchObject({ supersededBy: null, visible: true });
    expect(stored?.name).toBe(old.name);
  });

  it("keeps both sources when two merges read the record before either wrote", async () => {
    await (await poolsCollection()).insertOne(
      makePool({ _id: "otdb-9", slots: [{ mod: "NM", index: 1, beatmapId: 129891 }] }),
    );
    const stale = await loadExistingPools();
    await added({ maps: "NM1 129891", creditName: "First hosts" });
    const second = await added(
      { maps: "NM1 129891", creditName: "Second hosts" },
      { loadExisting: async () => stale },
    );
    expect(second).toMatchObject({ outcome: "merged", alreadyCredited: false });
    const stored = parseStoredPool(await (await poolsCollection()).findOne({ _id: "otdb-9" }));
    const names = stored?.sources.map((entry) =>
      "credit" in entry ? entry.credit.name : entry.kind,
    );
    expect(names).toEqual(["otdb", "First hosts", "Second hosts"]);
  });

  it("turns a create that lost the race into a merge", async () => {
    const stale = await loadExistingPools();
    const first = await added({ creditName: "First hosts" });
    const second = await added({ creditName: "Second hosts" }, { loadExisting: async () => stale });
    expect(second).toMatchObject({ outcome: "merged", pool: { id: first.pool.id } });
    const pools = await poolsCollection();
    expect(await pools.countDocuments()).toBe(1);
    const stored = parseStoredPool(await pools.findOne({ _id: first.pool.id }));
    expect(stored?.sources).toHaveLength(2);
  });

  it("adds nothing when the record already credits the same sender and link", async () => {
    const first = await added({ creditUrl: "https://example.com/cup" });
    const again = await added({ creditUrl: "https://example.com/cup" });
    expect(again).toMatchObject({
      outcome: "merged",
      alreadyCredited: true,
      pool: { id: first.pool.id },
    });
    const pools = await poolsCollection();
    expect(parseStoredPool(await pools.findOne({ _id: first.pool.id }))?.sources).toHaveLength(1);
    const otherLink = await added({ creditUrl: "https://example.com/other" });
    expect(otherLink.alreadyCredited).toBe(false);
  });

  it("skips a generated id that's already used", async () => {
    await (await poolsCollection()).insertOne(
      makePool({
        _id: "host-a0000000",
        sources: [{ kind: "host", id: "a0000000", credit: { name: "Someone" }, importedAt: T0 }],
        slots: [{ mod: "NM", index: 1, beatmapId: 5 }],
      }),
    );
    let call = 0;
    // The first id drawn is a0000000 (taken), the second b0000000.
    const random = (length: number) => Uint8Array.from({ length }, () => (call++ === 8 ? 1 : 0));
    const answer = await added({}, { random });
    expect(answer.pool.id).toBe("host-b0000000");
  });

  it("keeps a packs /k link's custom slot mods", async () => {
    const key = encodePackKey({
      name: "Speed Cup",
      slots: [
        { mod: "NM", index: 1, beatmapId: 129891 },
        { mod: "SV", index: 1, beatmapId: 75 },
      ],
      buckets: [
        { code: "NM" },
        { code: "HD" },
        { code: "HR" },
        { code: "DT" },
        { code: "FM" },
        { code: "SV", color: 0, mods: { kind: "forced", set: ["DT"] } },
        { code: "TB" },
      ],
    });
    const answer = await added({ maps: `https://packs.haruhime.moe/k#${key}` });
    const pool = parseStoredPool(await (await poolsCollection()).findOne({ _id: answer.pool.id }));
    expect(pool?.sourceSlots.map(({ label }) => label)).toEqual(["NM1", "SV1"]);
    expect(pool?.buckets).toContainEqual({
      code: "SV",
      color: 0,
      mods: { kind: "forced", set: ["DT"] },
    });
  });

  it.each([
    ["a /p/ link", "https://packs.haruhime.moe/p/Ab3_x-9QzP", /\/k link/],
    ["a damaged key", "pk1.AAAA", /./],
    ["a slot twice", "NM1 129891\nNM1 75", /Line 2: NM1 appears more than once/],
    [
      "65 maps",
      Array.from({ length: 65 }, (_, i) => String(1000 + i)).join("\n"),
      /at most 64 maps/,
    ],
  ])("answers a maps error for %s and writes nothing", async (_label, maps, message) => {
    const result = await addPool({ ...BODY, maps }, deps);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.fields.maps).toMatch(message);
    expect(await (await poolsCollection()).countDocuments()).toBe(0);
    expect(await (await mapsCollection()).countDocuments()).toBe(0);
  });

  it("saves the pool and says so when packs can't be reached for want of a token", async () => {
    const answer = await added({}, { packsService: () => null });
    expect(answer.outcome).toBe("created");
    expect(answer.sync).toEqual({
      status: "failed",
      message: "POOLS_SERVICE_TOKEN isn't set, so the pack wasn't updated.",
    });
    expect(await (await poolsCollection()).countDocuments()).toBe(1);
  });

  it("still saves when the mirror fails, and says why the maps weren't filled", async () => {
    const { http, HttpResponse } = await import("msw");
    server.use(
      http.get(HINAI_BATCH_URL, () => HttpResponse.json({ error: "down" }, { status: 400 })),
    );
    const answer = await added();
    expect(answer.outcome).toBe("created");
    expect(answer.maps.error).toMatch(/mirror/i);
    expect(await (await mapsCollection()).countDocuments({ metaSource: "none" })).toBe(3);
  });
});
