/**
 * @file tests/integration/services/import.test.ts
 * @desc Writing an import against the in-memory database: the sample export becomes 17 records
 *       (two pairs merged) with derived fields and notes; maps are seeded once from the export
 *       and a stored map is never overwritten; a second run writes nothing; an update keeps
 *       hidden, badged, edited and the pack state; a changed pool supersedes its record.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { mapsCollection } from "@/models/Map";
import { poolsCollection } from "@/models/Pool";
import { emptyPackSync, parseStoredPool } from "@/schemas/pool";
import { applyImportPlan, loadExistingPools, seedMaps } from "@/services/import";
import { planImport } from "@/utils/import-plan";
import { readOtdbExport } from "@/utils/otdb";
import { normalizePools } from "@/utils/source-pools";
import { setupTestDb } from "../../helpers/db";
import { T0 } from "../../helpers/records";

setupTestDb();

type RawPool = {
  id: number;
  name: string;
  beatmap_connections: { beatmap: { beatmap_metadata: { id: number } } }[];
};

const sample = (): RawPool[] =>
  JSON.parse(
    readFileSync(path.join(process.cwd(), "tests", "fixtures", "otdb", "sample.json"), "utf8"),
  ) as RawPool[];

const importExport = async (raw: unknown, now: Date = T0) => {
  const read = readOtdbExport(raw);
  const normalized = normalizePools(read.pools);
  const plan = planImport(
    normalized.pools,
    [...read.skipped, ...normalized.skipped],
    await loadExistingPools(),
    now,
  );
  await applyImportPlan(plan, now);
  const ids = normalized.pools.flatMap((pool) => pool.pool.slots.map((slot) => slot.beatmapId));
  const seeded = await seedMaps(read.maps, ids, now);
  return { plan, seeded, ids: new Set(ids) };
};

describe("applyImportPlan and seedMaps", () => {
  it("writes one record per pool, identical pools merged, with derived fields", async () => {
    const { plan } = await importExport(sample());
    expect(plan.creates).toHaveLength(17);
    const pools = await poolsCollection();
    expect(await pools.countDocuments()).toBe(17);
    const owc = parseStoredPool(await pools.findOne({ _id: "otdb-657" }));
    expect(owc).toMatchObject({
      tournament: "osu! World Cup",
      round: "Grand Finals",
      year: 2023,
      tournamentKey: "osu-world-cup",
      notes: "FM3 is different version from OWC.",
      visible: true,
      hidden: false,
      badged: null,
      edited: {},
      pack: emptyPackSync(),
      stats: { complete: false },
    });
    expect((await pools.findOne({ _id: "otdb-71" }))?.sources.map((source) => source.id)).toEqual([
      "71",
      "418",
    ]);
    expect(await pools.findOne({ _id: "otdb-418" })).toBeNull();
    for (const row of await pools.find().toArray()) expect(parseStoredPool(row)).not.toBeNull();
  });

  it("seeds each map once from the export and never overwrites a stored map", async () => {
    const first = await importExport(sample());
    expect(first.seeded).toBe(first.ids.size);
    const maps = await mapsCollection();
    expect(await maps.findOne({ _id: 989603 })).toMatchObject({
      artist: "ChouCho",
      stars: null,
      metaSource: "otdb",
      usage: { count: 0, shown: false },
    });
    await maps.updateOne({ _id: 989603 }, { $set: { stars: 6.1, metaSource: "mirror" } });
    expect((await importExport(sample())).seeded).toBe(0);
    expect(await maps.findOne({ _id: 989603 })).toMatchObject({ stars: 6.1, metaSource: "mirror" });
  });

  it("writes nothing on a second run", async () => {
    await importExport(sample(), T0);
    const second = await importExport(sample(), new Date("2026-10-01T00:00:00.000Z"));
    expect(second.plan.creates).toEqual([]);
    expect(second.plan.updates).toEqual([]);
    expect(second.plan.unchanged).toHaveLength(17);
  });

  it("keeps hidden, badged, edited and the pack state when a source renames its pool", async () => {
    await importExport(sample());
    const pools = await poolsCollection();
    await pools.updateOne(
      { _id: "otdb-58" },
      {
        $set: {
          hidden: true,
          visible: false,
          badged: true,
          edited: { year: 2018 },
          pack: { ...emptyPackSync(), slug: "Ab3_x-9QzP", state: "created", listed: true },
        },
      },
    );
    const renamed = sample();
    const first = renamed[0];
    if (!first) throw new Error("empty sample");
    first.name = "Cindelluna's Winter Tour 2019 Grand Finals (20k-10k)";
    const { plan } = await importExport(renamed, new Date("2026-10-01T00:00:00.000Z"));
    expect(plan.updates.map(({ pool }) => pool.id)).toEqual(["otdb-58"]);
    expect(await pools.findOne({ _id: "otdb-58" })).toMatchObject({
      name: "Cindelluna's Winter Tour 2019 Grand Finals (20k-10k)",
      round: "Grand Finals (20k-10k)",
      year: 2018,
      hidden: true,
      visible: false,
      badged: true,
      pack: { slug: "Ab3_x-9QzP", state: "created" },
    });
  });

  it("supersedes a changed pool's record and writes its successor", async () => {
    await importExport(sample());
    const changed = sample();
    const map = changed[0]?.beatmap_connections[0]?.beatmap.beatmap_metadata;
    if (!map) throw new Error("empty sample");
    map.id = 75;
    await importExport(changed, new Date("2026-10-01T00:00:00.000Z"));
    const pools = await poolsCollection();
    expect(await pools.findOne({ _id: "otdb-58" })).toMatchObject({
      supersededBy: "otdb-58-2",
      visible: false,
      sources: [],
      formerSources: [{ kind: "otdb", id: "58" }],
    });
    expect(await pools.findOne({ _id: "otdb-58-2" })).toMatchObject({
      supersededBy: null,
      visible: true,
      sources: [{ kind: "otdb", id: "58" }],
    });
  });
});
