/**
 * @file tests/unit/utils/otdb.test.ts
 * @desc otdb's export (a committed sample of 22 real pools) to source pools: links, labels, osu!
 *       beatmap ids (not otdb's own), each map's mods, the notes, what the export says about
 *       each map (never its star ratings), bad entries skipped, and no submitter data kept.
 *       Through normalizePools: the pool with a slot twice and the EZ World Cup pools that mix
 *       mods are skipped, EZ pools keep their EZ, identical pools share a fingerprint.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { otdbPoolUrl, otdbSource, readOtdbExport } from "@/utils/otdb";
import { normalizePools } from "@/utils/source-pools";

const SAMPLE: unknown = JSON.parse(
  readFileSync(path.join(process.cwd(), "tests", "fixtures", "otdb", "sample.json"), "utf8"),
);

const entry = (id: number, connections: unknown[], description: unknown = "") => ({
  id,
  name: `Cup ${id} Finals`,
  description,
  submitted_by: { id: 1, username: "someone", avatar: "https://a.ppy.sh/1" },
  favorite_count: 3,
  beatmap_connections: connections,
});

const connection = (slot: string, osuId: number, mods: string[]) => ({
  slot,
  beatmap: {
    id: 9000 + osuId,
    star_rating: 5,
    beatmapset_metadata: { id: 1, artist: "a", title: "t", creator: "c" },
    beatmap_metadata: {
      id: osuId,
      difficulty: "d",
      ar: 9,
      od: 8,
      cs: 4,
      hp: 6,
      length: 100,
      bpm: 150,
    },
    mods: mods.map((acronym, i) => ({ id: i, acronym, settings: {} })),
  },
});

describe("otdb links", () => {
  it("builds a pool's link and source", () => {
    expect(otdbPoolUrl(58)).toBe("https://otdb.sheppsu.me/db/mappools/58/");
    expect(otdbSource("657")).toEqual({
      kind: "otdb",
      id: "657",
      url: "https://otdb.sheppsu.me/db/mappools/657/",
    });
  });
});

describe("readOtdbExport", () => {
  it("reads every sample pool with its link, labels, osu! beatmap ids and notes", () => {
    const { pools, skipped } = readOtdbExport(SAMPLE);
    expect(skipped).toEqual([]);
    expect(pools).toHaveLength(22);
    const [first] = pools;
    expect(first?.source).toEqual(otdbSource(58));
    expect(first?.name).toBe("Cindelluna's Winter Tour 2019 Finals (20k-10k)");
    expect(first?.notes).toBe("");
    expect(first?.slots.slice(0, 2)).toEqual([
      { label: "NM1", beatmapId: 989603, mods: [] },
      // otdb shares a map's entry between pools, so an NM slot can list another pool's mods.
      { label: "NM2", beatmapId: 1389960, mods: ["HD"] },
    ]);
    expect(pools.find((pool) => pool.source.id === "657")?.notes).toBe(
      "FM3 is different version from OWC.",
    );
  });

  it("keeps what the export says about each map, never its star ratings", () => {
    expect(readOtdbExport(SAMPLE).maps.get(989603)).toEqual({
      setId: 460580,
      artist: "ChouCho",
      title: "bouquet",
      setHost: "Kibbleru",
      version: "Sotarks' Extra",
      ar: 9.2,
      od: 8.2,
      cs: 4.2,
      hp: 6.2,
      length: 260,
      bpm: 192,
    });
  });

  it("keeps no submitter data or favorite counts", () => {
    const read = readOtdbExport([entry(1, [connection("NM1", 5, [])])]);
    expect(JSON.stringify({ ...read, maps: [...read.maps] })).not.toMatch(
      /someone|submitted|favorite|a\.ppy\.sh/,
    );
  });

  it("reads a missing or null description as no notes", () => {
    const { pools } = readOtdbExport([
      entry(1, [connection("NM1", 5, [])], undefined),
      entry(2, [connection("NM1", 6, [])], null),
    ]);
    expect(pools.map((pool) => pool.notes)).toEqual(["", ""]);
  });

  it("skips entries that don't match the export's format", () => {
    const { pools, skipped } = readOtdbExport([
      entry(1, [connection("NM1", 5, [])]),
      { id: 2, name: "No maps field" },
      { name: "No id", beatmap_connections: [] },
      "not a pool",
      entry(3, [{ slot: "NM1", beatmap: { star_rating: 5, mods: [] } }]),
    ]);
    expect(pools.map((pool) => pool.source.id)).toEqual(["1"]);
    expect(skipped).toEqual([
      {
        kind: "otdb",
        id: "2",
        name: "No maps field",
        reason: "Doesn't match the otdb export's format.",
      },
      {
        kind: "otdb",
        id: "entry 3",
        name: "No id",
        reason: "Doesn't match the otdb export's format.",
      },
      { kind: "otdb", id: "entry 4", name: "", reason: "Doesn't match the otdb export's format." },
      {
        kind: "otdb",
        id: "3",
        name: "Cup 3 Finals",
        reason: "Doesn't match the otdb export's format.",
      },
    ]);
  });

  it("refuses an export that isn't a list", () => {
    expect(() => readOtdbExport({ pools: [] })).toThrow("The otdb export isn't a list of pools.");
  });
});

describe("the sample through normalizePools", () => {
  const read = readOtdbExport(SAMPLE);
  const { pools, skipped } = normalizePools(read.pools);
  const byId = (id: string) => pools.find((pool) => pool.source.id === id);

  it("skips the pool with a slot listed twice, and the EZ World Cup pools that mix mods", () => {
    expect(skipped).toEqual([
      {
        kind: "otdb",
        id: "481",
        name: "Lobby 42: Roulette Team Solos Round of 16",
        reason: "Slot DT1: DT1 appears more than once.",
      },
      {
        kind: "otdb",
        id: "665",
        name: "EZ World Cup Qualifiers",
        reason:
          "Maps without a slot are played with mods (EZHT, EZ, EZDT), which a map without a slot can't hold.",
      },
      {
        kind: "otdb",
        id: "670",
        name: "EZ World Cup Finals",
        reason:
          "Slot S: its maps are played with different mods (EZ, EZDT, EZHT), which one slot can't hold.",
      },
    ]);
    expect(pools).toHaveLength(19);
  });

  it("reads custom labels and their mods, with the EZ every map carries", () => {
    expect(byId("641")?.pool.buckets?.filter((entry) => "color" in entry)).toEqual([
      { code: "EZ", color: 0, mods: { kind: "forced", set: ["EZ"] } },
      { code: "EZHD", color: 1, mods: { kind: "forced", set: ["EZ", "HD"] } },
      { code: "EZDT", color: 2, mods: { kind: "forced", set: ["EZ", "DT"] } },
      { code: "EZHDDT", color: 3, mods: { kind: "forced", set: ["EZ", "HD", "DT"] } },
      { code: "EZHT", color: 4, mods: { kind: "forced", set: ["EZ", "HT"] } },
      { code: "EZHDHT", color: 5, mods: { kind: "forced", set: ["EZ", "HD", "HT"] } },
    ]);
  });

  it("gives the two pairs of identical pools the same fingerprints", () => {
    expect(byId("418")?.fingerprint).toBe(byId("71")?.fingerprint);
    expect(byId("445")?.fingerprint).toBe(byId("283")?.fingerprint);
    expect(new Set(pools.map((pool) => pool.fingerprint)).size).toBe(17);
  });

  it("keeps the source's labels, mods and notes", () => {
    expect(byId("657")?.notes).toBe("FM3 is different version from OWC.");
    expect(byId("58")?.sourceSlots[1]).toEqual({ label: "NM2", beatmapId: 1389960, mods: ["HD"] });
  });
});
