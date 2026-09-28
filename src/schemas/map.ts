/**
 * @file src/schemas/map.ts
 * @desc A map (difficulty) as stored in the maps collection: set, artist, title, difficulty
 *       name, set host, mode, AR/OD/CS/HP, length, BPM and no-mod stars (all without mods),
 *       checksum, where the details came from (otdb's export or nothing until the mirror
 *       answers), search and sort keys, and usage (count, last year, played as, shown).
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Mon Sep 28, 2026
 */

import { beatmapIdSchema, RULESETS } from "@haruhimemoe/pool";
import { z } from "zod";
import { PLAYED_AS_CODES } from "@/constants/pools";

/**
 * otdb: seeded from the export; mirror: the mirror answered for it; none: a map an admin added
 * that pools had never seen, every detail blank until the mirror answers.
 */
export const META_SOURCES = ["otdb", "mirror", "none"] as const;

/** Rows the mirror fill asks about: everything it hasn't answered yet. */
export const UNFILLED_META_SOURCES = ["otdb", "none"] as const;

/** A map's usage: distinct current pools, the latest year, played as, and whether it has a page. */
export const mapUsageSchema = z.object({
  /** Distinct current pools (not hidden, not superseded) that have the map. */
  count: z.number().int().nonnegative(),
  /** The highest known year among them. */
  lastYear: z.number().int().nullable(),
  playedAs: z.array(z.enum(PLAYED_AS_CODES)),
  /** Some pool that isn't hidden has it (superseded ones count): /maps/[id] exists. */
  shown: z.boolean(),
});

/** A map's usage. */
export type StoredMapUsage = z.infer<typeof mapUsageSchema>;

/** A map row: its details, where they came from, and its usage. */
export const storedMapSchema = z.object({
  _id: beatmapIdSchema,
  setId: z.number().int().positive().nullable(),
  artist: z.string().nullable(),
  title: z.string().nullable(),
  version: z.string().nullable(),
  setHost: z.string().nullable(),
  setHostId: z.number().int().positive().nullable(),
  mode: z.enum(RULESETS).nullable(),
  ar: z.number().nullable(),
  od: z.number().nullable(),
  cs: z.number().nullable(),
  hp: z.number().nullable(),
  length: z.number().nullable(),
  bpm: z.number().nullable(),
  stars: z.number().nullable(),
  checksum: z.string().nullable(),
  metaSource: z.enum(META_SOURCES),
  searchText: z.string(),
  sortTitle: z.string(),
  usage: mapUsageSchema,
  updatedAt: z.date(),
});

/** A map row. */
export type StoredMap = z.infer<typeof storedMapSchema>;

/**
 * @function parseStoredMap
 * @param doc {unknown} a maps row
 * @returns {StoredMap | null} the map, or null when the row doesn't parse
 */
export const parseStoredMap = (doc: unknown): StoredMap | null => {
  const parsed = storedMapSchema.safeParse(doc);
  return parsed.success ? parsed.data : null;
};
