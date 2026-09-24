/**
 * @file tests/integration/services/admin.test.ts
 * @desc Admin saves against the database and a stand-in packs: only edits that differ from the
 *       name are stored; the key, search text and visibility follow; hiding or re-dating a pool
 *       rebuilds its maps' usage; the pack is re-sent only when its input changes (never for
 *       notes or badged, never when gone), a failed PUT stays as error, a missing token is said;
 *       badged changes a whole tournament (one year, unknown years, or all); retries send error
 *       pools (and rejected ones on request, 50 at most); edits survive a rerun of the import
 *       and carry to a successor; the admin list shows every pool (hidden and superseded
 *       included), narrows by show, matches text as plain text and pages 50 at a time; and the
 *       sync-state counts read a pool never sent as "never".
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { mapsCollection } from "@/models/Map";
import { poolsCollection } from "@/models/Pool";
import { emptyPackSync, type StoredPool } from "@/schemas/pool";
import {
  type AdminShow,
  countSyncStates,
  listPoolsForAdmin,
  retrySyncs,
  savePoolEdit,
  setBadged,
} from "@/services/admin";
import { applyImportPlan, loadExistingPools, seedMaps } from "@/services/import";
import { recomputeUsage } from "@/services/usage";
import { planImport } from "@/utils/import-plan";
import { readOtdbExport } from "@/utils/otdb";
import { packInputHash, packInputOf } from "@/utils/pack-input";
import { normalizePools } from "@/utils/source-pools";
import { setupTestDb } from "../../helpers/db";
import { setupMsw } from "../../helpers/msw";
import {
  createdAnswer,
  type PutCall,
  packsPutHandler,
  TEST_SERVICE,
} from "../../helpers/packs-server";
import { makeMap, makePool, T0 } from "../../helpers/records";

setupTestDb();
const server = setupMsw();

const deps = { packsService: () => TEST_SERVICE, now: () => T0 };

const synced = (pool: StoredPool): StoredPool => ({
  ...pool,
  pack: {
    ...emptyPackSync(),
    slug: "Ab3_x-9QzP",
    state: "created",
    listed: true,
    inputHash: packInputHash(packInputOf(pool)),
  },
});

const OWC = synced(
  makePool({
    _id: "otdb-657",
    name: "osu! World Cup 2023 Grand Finals",
    notes: "FM3 is different version from OWC.",
    slots: [{ mod: "NM", index: 1, beatmapId: 1 }],
  }),
);

const FORM = {
  tournament: "osu! World Cup",
  round: "Grand Finals",
  year: 2023,
  notes: "FM3 is different version from OWC.",
  hidden: false,
  badged: null,
};

describe("savePoolEdit", () => {
  it("stores only what differs, and re-sends the pack when its input changed", async () => {
    await (await poolsCollection()).insertOne(OWC);
    const calls: PutCall[] = [];
    server.use(packsPutHandler((id) => createdAnswer(id), calls));
    const result = await savePoolEdit("otdb-657", { ...FORM, tournament: "OWC", year: 2024 }, deps);
    expect(result?.pool).toMatchObject({
      edited: { tournament: "OWC", year: 2024 },
      tournament: "OWC",
      year: 2024,
      tournamentKey: "owc",
      searchText: "osu! world cup 2023 grand finals\nowc\ngrand finals",
    });
    expect(result?.sync).toEqual({ status: "sent", state: "created", error: null });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.body.description).toBe(
      "OWC Grand Finals (2024). Pool details and sources: https://pools.haruhime.moe/pools/otdb-657",
    );
  });

  it("doesn't re-send for notes or badged, nor for a pack packs deleted", async () => {
    const pools = await poolsCollection();
    await pools.insertMany([
      OWC,
      {
        ...OWC,
        _id: "otdb-658",
        fingerprint: "b".repeat(64),
        pack: { ...OWC.pack, state: "gone" },
      },
    ]);
    const calls: PutCall[] = [];
    server.use(packsPutHandler((id) => createdAnswer(id), calls));
    const notes = await savePoolEdit(
      "otdb-657",
      { ...FORM, notes: "New rules.", badged: true },
      deps,
    );
    expect(notes?.sync).toEqual({ status: "not-needed" });
    expect(notes?.pool).toMatchObject({ edited: { notes: "New rules." }, badged: true });
    const gone = await savePoolEdit("otdb-658", { ...FORM, hidden: true }, deps);
    expect(gone?.sync).toEqual({ status: "not-needed" });
    expect(calls).toEqual([]);
  });

  it("hides a pool: out of usage, unlisted on packs", async () => {
    await (await poolsCollection()).insertOne(OWC);
    await (await mapsCollection()).insertOne(makeMap({ _id: 1 }));
    await recomputeUsage();
    const calls: PutCall[] = [];
    server.use(packsPutHandler((id) => createdAnswer(id), calls));
    const result = await savePoolEdit("otdb-657", { ...FORM, hidden: true }, deps);
    expect(result?.pool).toMatchObject({ hidden: true, visible: false });
    expect((await (await mapsCollection()).findOne({ _id: 1 }))?.usage).toMatchObject({
      count: 0,
      shown: false,
    });
    expect(calls[0]?.body.visibility).toBe("unlisted");
  });

  it("keeps a failed PUT as error and says so, and says when there's no token", async () => {
    await (await poolsCollection()).insertOne(OWC);
    server.use(
      packsPutHandler(() => HttpResponse.json({ error: { message: "Oops." } }, { status: 500 })),
    );
    const failed = await savePoolEdit("otdb-657", { ...FORM, year: 2022 }, deps);
    expect(failed?.sync).toEqual({
      status: "sent",
      state: "error",
      error: "packs answered 500: Oops.",
    });
    const noToken = await savePoolEdit(
      "otdb-657",
      { ...FORM, year: 2021 },
      { ...deps, packsService: () => null },
    );
    expect(noToken?.sync).toEqual({
      status: "failed",
      message: "POOLS_SERVICE_TOKEN isn't set, so the pack wasn't updated.",
    });
    expect(noToken?.pool.year).toBe(2021);
  });

  it("answers null for a pool that doesn't exist", async () => {
    expect(await savePoolEdit("otdb-1", FORM, deps)).toBeNull();
  });
});

describe("setBadged", () => {
  it("sets a tournament's pools for one year, unknown years, or all", async () => {
    await (await poolsCollection()).insertMany([
      makePool({
        _id: "otdb-1",
        name: "Spring Cup 2020 Finals",
        slots: [{ mod: "NM", index: 1, beatmapId: 1 }],
      }),
      makePool({
        _id: "otdb-2",
        name: "Spring Cup 2021 Finals",
        slots: [{ mod: "NM", index: 1, beatmapId: 2 }],
      }),
      makePool({
        _id: "otdb-3",
        name: "Spring Cup Finals",
        slots: [{ mod: "NM", index: 1, beatmapId: 3 }],
      }),
      makePool({
        _id: "otdb-4",
        name: "Autumn Cup 2020 Finals",
        slots: [{ mod: "NM", index: 1, beatmapId: 4 }],
      }),
    ]);
    expect(
      await setBadged({ tournamentKey: "spring-cup", year: 2020, badged: true }, deps),
    ).toEqual({ matched: 1 });
    expect(
      await setBadged({ tournamentKey: "spring-cup", year: null, badged: false }, deps),
    ).toEqual({ matched: 1 });
    expect(
      await setBadged({ tournamentKey: "spring-cup", year: "all", badged: null }, deps),
    ).toEqual({ matched: 3 });
    expect(
      await setBadged({ tournamentKey: "spring-cup", year: 2021, badged: true }, deps),
    ).toEqual({ matched: 1 });
    const badged = await (await poolsCollection())
      .find({}, { projection: { badged: 1 }, sort: { _id: 1 } })
      .toArray();
    expect(badged.map((pool) => pool.badged)).toEqual([null, true, null, null]);
  });
});

describe("retrySyncs", () => {
  it("sends error pools, rejected ones only on request", async () => {
    await (await poolsCollection()).insertMany([
      makePool({
        _id: "otdb-1",
        slots: [{ mod: "NM", index: 1, beatmapId: 1 }],
        pack: { ...emptyPackSync(), state: "error" },
      }),
      synced(makePool({ _id: "otdb-2", slots: [{ mod: "NM", index: 1, beatmapId: 2 }] })),
      {
        ...synced(makePool({ _id: "otdb-3", slots: [{ mod: "NM", index: 1, beatmapId: 3 }] })),
        pack: {
          ...emptyPackSync(),
          state: "rejected",
          inputHash: packInputHash(
            packInputOf(
              makePool({ _id: "otdb-3", slots: [{ mod: "NM", index: 1, beatmapId: 3 }] }),
            ),
          ),
        },
      },
    ]);
    const calls: PutCall[] = [];
    server.use(packsPutHandler((id) => createdAnswer(id), calls));
    expect(await retrySyncs({ includeRejected: false }, deps)).toMatchObject({
      due: 1,
      sent: 1,
      remaining: 0,
    });
    expect(calls.map((call) => call.id)).toEqual(["otdb-1"]);
    calls.length = 0;
    expect(await retrySyncs({ includeRejected: true }, deps)).toMatchObject({ due: 1, sent: 1 });
    expect(calls.map((call) => call.id)).toEqual(["otdb-3"]);
  });
});

describe("listPoolsForAdmin and countSyncStates", () => {
  const seedAdminPools = async () => {
    await (await poolsCollection()).insertMany([
      makePool({
        _id: "otdb-1",
        name: "Alpha Cup (20k-10k) Finals",
        slots: [{ mod: "NM", index: 1, beatmapId: 1 }],
        pack: { ...emptyPackSync(), state: "created" },
      }),
      makePool({
        _id: "otdb-2",
        name: "Beta Cup Finals",
        hidden: true,
        slots: [{ mod: "NM", index: 1, beatmapId: 2 }],
        pack: { ...emptyPackSync(), state: "error" },
      }),
      makePool({
        _id: "otdb-3",
        name: "Gamma Cup Finals",
        supersededBy: "otdb-1",
        slots: [{ mod: "NM", index: 1, beatmapId: 3 }],
      }),
      makePool({
        _id: "otdb-4",
        name: "Delta Cup Finals",
        slots: [{ mod: "NM", index: 1, beatmapId: 4 }],
        pack: { ...emptyPackSync(), state: "rejected" },
      }),
    ]);
  };

  const list = async (show: AdminShow, q = "") =>
    (await listPoolsForAdmin({ q, show, page: 1 })).rows.map((row) => row._id);

  it("shows every pool, hidden and superseded included, and narrows by show", async () => {
    await seedAdminPools();
    expect(await list("all")).toEqual(["otdb-1", "otdb-2", "otdb-3", "otdb-4"]);
    expect(await list("hidden")).toEqual(["otdb-2"]);
    expect(await list("superseded")).toEqual(["otdb-3"]);
    expect(await list("failed")).toEqual(["otdb-2", "otdb-4"]);
  });

  it("matches typed text as plain text", async () => {
    await seedAdminPools();
    expect(await list("all", "(20k")).toEqual(["otdb-1"]);
    expect(await list("all", "cup [ez] .*")).toEqual([]);
  });

  it("pages 50 at a time", async () => {
    await (await poolsCollection()).insertMany(
      Array.from({ length: 60 }, (_, i) =>
        makePool({
          _id: `otdb-${100 + i}`,
          name: `Cup ${100 + i} Finals`,
          slots: [{ mod: "NM", index: 1, beatmapId: 1000 + i }],
        }),
      ),
    );
    const second = await listPoolsForAdmin({ q: "", show: "all", page: 2 });
    expect(second).toMatchObject({ total: 60, page: 2, pageCount: 2 });
    expect(second.rows).toHaveLength(10);
  });

  it("counts pools per sync state, a pool never sent as never", async () => {
    await seedAdminPools();
    expect(await countSyncStates()).toEqual({
      created: 1,
      updated: 0,
      unchanged: 0,
      rejected: 1,
      error: 1,
      gone: 0,
      never: 1,
    });
  });
});

describe("edits and the import", () => {
  type RawPool = {
    id: number;
    beatmap_connections: { beatmap: { beatmap_metadata: { id: number } } }[];
  };
  const sample = (): RawPool[] =>
    JSON.parse(
      readFileSync(path.join(process.cwd(), "tests", "fixtures", "otdb", "sample.json"), "utf8"),
    ) as RawPool[];
  const importExport = async (raw: unknown) => {
    const read = readOtdbExport(raw);
    const normalized = normalizePools(read.pools);
    const plan = planImport(
      normalized.pools,
      [...read.skipped, ...normalized.skipped],
      await loadExistingPools(),
      T0,
    );
    await applyImportPlan(plan, T0);
    await seedMaps(
      read.maps,
      normalized.pools.flatMap((pool) => pool.pool.slots.map((slot) => slot.beatmapId)),
      T0,
    );
  };

  it("keeps an admin's edits through a rerun and carries them to a successor", async () => {
    await importExport(sample());
    await savePoolEdit(
      "otdb-657",
      { ...FORM, round: "Finals", year: 2022, hidden: true, badged: true },
      { ...deps, packsService: () => null },
    );
    await importExport(sample());
    const pools = await poolsCollection();
    expect(await pools.findOne({ _id: "otdb-657" })).toMatchObject({
      round: "Finals",
      year: 2022,
      hidden: true,
      badged: true,
    });
    const changed = sample();
    const owc = changed.find((pool) => pool.id === 657);
    const map = owc?.beatmap_connections[0]?.beatmap.beatmap_metadata;
    if (!map) throw new Error("no #657 in the sample");
    map.id = 75;
    await importExport(changed);
    expect(await pools.findOne({ _id: "otdb-657-2" })).toMatchObject({
      edited: { round: "Finals", year: 2022 },
      round: "Finals",
      year: 2022,
      hidden: true,
      badged: true,
      visible: false,
    });
  });
});
