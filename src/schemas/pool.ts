/**
 * @file src/schemas/pool.ts
 * @desc A pool record as stored in the pools collection: the canonical @haruhimemoe/pool shape
 *       (name, slots, buckets when not the default) plus tournament, round and year (effective:
 *       an admin's edit wins over the name), the edits themselves, the tournament key, badged,
 *       the source notes and labels, fingerprint, sources (and former ones), stats, versioning,
 *       visibility, the pack sync state, and search keys. Reads parse against it; a row that
 *       doesn't parse is left out, never shown half-broken.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { beatmapIdSchema, poolFields } from "@haruhimemoe/pool";
import { z } from "zod";
import { POOL_ID_PATTERN, SOURCE_KINDS } from "@/constants/pools";

/** Source links end up in hrefs: https only. */
const httpsUrl = z.url({ protocol: /^https$/ });

export const SYNC_STATES = [
  "created",
  "updated",
  "unchanged",
  "rejected",
  "error",
  "gone",
] as const;

export type SyncState = (typeof SYNC_STATES)[number];

/** States in which packs has the pool's current pack. */
export const LISTED_STATES: readonly SyncState[] = ["created", "updated", "unchanged"];

export const poolIdSchema = z.string().regex(POOL_ID_PATTERN);

/** packs' slugs are nanoids; anything else never reaches an href. */
export const packSlugSchema = z.string().regex(/^[A-Za-z0-9_-]{1,32}$/);

const sha256Schema = z.string().regex(/^[0-9a-f]{64}$/);

export const packSyncSchema = z.object({
  slug: packSlugSchema.nullable(),
  state: z.enum(SYNC_STATES).nullable(),
  listed: z.boolean().nullable(),
  /** The input hash packs last answered definitively (created, updated, unchanged, rejected). */
  inputHash: sha256Schema.nullable(),
  syncedAt: z.date().nullable(),
  error: z.string().nullable(),
});

export type PackSync = z.infer<typeof packSyncSchema>;

/**
 * @function emptyPackSync
 * @returns {PackSync} a pool never sent to packs
 */
export const emptyPackSync = (): PackSync => ({
  slug: null,
  state: null,
  listed: null,
  inputHash: null,
  syncedAt: null,
  error: null,
});

export const poolSourceSchema = z.object({
  kind: z.enum(SOURCE_KINDS),
  id: z.string().min(1),
  url: httpsUrl,
  importedAt: z.date(),
});

export type PoolSource = z.infer<typeof poolSourceSchema>;

/** A source that pointed here until its pool changed there. */
export const formerSourceSchema = poolSourceSchema.extend({ leftAt: z.date() });

export type FormerSource = z.infer<typeof formerSourceSchema>;

/** A map as the source listed it: label, beatmap id and the mods it named. */
export const sourceSlotSchema = z.object({
  label: z.string(),
  beatmapId: beatmapIdSchema,
  mods: z.array(z.string()),
});

export type SourceSlotRecord = z.infer<typeof sourceSlotSchema>;

export const poolStatsSchema = z.object({
  srMin: z.number().nullable(),
  srMax: z.number().nullable(),
  lenMin: z.number().nullable(),
  lenMax: z.number().nullable(),
  bpmMin: z.number().nullable(),
  bpmMax: z.number().nullable(),
  count: z.number().int().nonnegative(),
  complete: z.boolean(),
});

export type PoolStats = z.infer<typeof poolStatsSchema>;

/** Admin overrides: a key that's there wins (round and year may be set to null on purpose). */
export const poolEditsSchema = z.object({
  tournament: z.string().optional(),
  round: z.string().nullable().optional(),
  year: z.number().int().nullable().optional(),
  notes: z.string().optional(),
});

export type PoolEdits = z.infer<typeof poolEditsSchema>;

export const storedPoolSchema = poolFields.extend({
  _id: poolIdSchema,
  tournament: z.string().min(1),
  round: z.string().nullable(),
  year: z.number().int().nullable(),
  edited: poolEditsSchema,
  tournamentKey: z.string().min(1),
  badged: z.boolean().nullable(),
  notes: z.string(),
  sourceSlots: z.array(sourceSlotSchema),
  fingerprint: sha256Schema,
  sources: z.array(poolSourceSchema),
  formerSources: z.array(formerSourceSchema),
  stats: poolStatsSchema,
  supersededBy: poolIdSchema.nullable(),
  hidden: z.boolean(),
  visible: z.boolean(),
  pack: packSyncSchema,
  searchText: z.string(),
  sortName: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type StoredPool = z.infer<typeof storedPoolSchema>;

/**
 * @function parseStoredPool
 * @param doc {unknown} a pools row
 * @returns {StoredPool | null} the pool, or null when the row doesn't parse
 */
export const parseStoredPool = (doc: unknown): StoredPool | null => {
  const parsed = storedPoolSchema.safeParse(doc);
  return parsed.success ? parsed.data : null;
};
