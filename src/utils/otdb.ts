/**
 * @file src/utils/otdb.ts
 * @desc otdb's mappool export to source pools: each pool's id, name, notes (its description),
 *       link and slots (label, osu! beatmap id, and the mods otdb lists for it), plus what the
 *       export says about each map (set, artist, title, set host, difficulty name, AR/OD/CS/HP,
 *       length and BPM, all without mods). The export's star ratings are never read: they carry
 *       the entry's mods and some are stale. Entries that don't match the export's shape are
 *       skipped with a reason. Submitters and favorite counts are never read. Pure.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { OTDB_POOL_URL_PREFIX } from "@/constants/pools";
import { otdbPoolSchema } from "@/schemas/otdb";
import type { MapSeed } from "@/utils/map-record";
import type { SkippedPool, SourcePool, SourceRef } from "@/utils/source-pools";

/**
 * @function otdbPoolUrl
 * @param id {number | string} an otdb pool id
 * @returns {string} that pool's page on otdb
 */
export const otdbPoolUrl = (id: number | string): string => `${OTDB_POOL_URL_PREFIX}${id}/`;

/**
 * @function otdbSource
 * @param id {number | string} an otdb pool id
 * @returns {SourceRef} the pool as a source
 */
export const otdbSource = (id: number | string): SourceRef => ({
  kind: "otdb",
  id: String(id),
  url: otdbPoolUrl(id),
});

export type OtdbRead = {
  pools: SourcePool[];
  /** What the export says about each map, by osu! beatmap id (the first entry wins). */
  maps: Map<number, MapSeed>;
  skipped: SkippedPool[];
};

/** Whatever id and name an entry that doesn't parse still has, for the report. */
const describeBad = (item: unknown, position: number): { id: string; name: string } => {
  const record = typeof item === "object" && item !== null ? (item as Record<string, unknown>) : {};
  return {
    id: typeof record.id === "number" ? String(record.id) : `entry ${position + 1}`,
    name: typeof record.name === "string" ? record.name : "",
  };
};

/**
 * @function readOtdbExport
 * @param raw {unknown} the export as parsed JSON
 * @returns {OtdbRead} every pool that matches the export's shape as a source pool (same order),
 *          what the export says about their maps, and the entries that don't match
 * @throws {Error} when the export isn't a list of pools at all
 */
export const readOtdbExport = (raw: unknown): OtdbRead => {
  if (!Array.isArray(raw)) throw new Error("The otdb export isn't a list of pools.");
  const pools: SourcePool[] = [];
  const maps = new Map<number, MapSeed>();
  const skipped: SkippedPool[] = [];
  raw.forEach((item: unknown, position) => {
    const parsed = otdbPoolSchema.safeParse(item);
    if (!parsed.success) {
      skipped.push({
        kind: "otdb",
        ...describeBad(item, position),
        reason: "Doesn't match the otdb export's format.",
      });
      return;
    }
    const pool = parsed.data;
    for (const { beatmap } of pool.beatmap_connections) {
      const set = beatmap.beatmapset_metadata;
      const map = beatmap.beatmap_metadata;
      if (maps.has(map.id)) continue;
      maps.set(map.id, {
        setId: set.id,
        artist: set.artist,
        title: set.title,
        setHost: set.creator,
        version: map.difficulty,
        ar: map.ar,
        od: map.od,
        cs: map.cs,
        hp: map.hp,
        length: map.length,
        bpm: map.bpm,
      });
    }
    pools.push({
      source: otdbSource(pool.id),
      name: pool.name,
      notes: pool.description,
      slots: pool.beatmap_connections.map(({ slot, beatmap }) => ({
        label: slot,
        beatmapId: beatmap.beatmap_metadata.id,
        mods: beatmap.mods.map(({ acronym }) => acronym),
      })),
    });
  });
  return { pools, maps, skipped };
};
