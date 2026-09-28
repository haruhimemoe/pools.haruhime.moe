/**
 * @file src/schemas/pool.ts
 * @desc A pool record as stored in the pools collection: the canonical @haruhimemoe/pool shape
 *       (name, slots, buckets when not the default) plus tournament, round and year (effective:
 *       an admin's edit wins over the name), the edits themselves, the tournament key, badged,
 *       the source notes and labels, fingerprint, sources (and former ones), stats, versioning,
 *       visibility, the pack sync state, and search keys. Sources are one of three kinds: otdb
 *       (its v1 shape, with the pool's otdb link) or host and community (a generated id and the
 *       credit an admin typed: a name through the content filter and an optional https link,
 *       whose key is left out when there is none, never stored as null). Reads parse against
 *       it; a row that doesn't parse is left out, never shown half-broken.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Mon Sep 28, 2026
 */

import { beatmapIdSchema, poolFields } from "@haruhimemoe/pool";
import { hasBlockedLanguage } from "@haruhimemoe/pool/content-filter";
import { z } from "zod";
import { MAX_CREDIT_NAME_LENGTH, POOL_ID_PATTERN } from "@/constants/pools";
import { SOURCE_ID_PATTERN } from "@/utils/source-ids";

/** Source links end up in hrefs: https only. */
const httpsUrl = z.url({ protocol: /^https$/ });

/** Where a past pool's pack stands on packs. */
export const SYNC_STATES = [
  "created",
  "updated",
  "unchanged",
  "rejected",
  "error",
  "gone",
] as const;

/** One of SYNC_STATES. */
export type SyncState = (typeof SYNC_STATES)[number];

/** States in which packs has the pool's current pack. */
export const LISTED_STATES: readonly SyncState[] = ["created", "updated", "unchanged"];

/** A past pool id: <source>-<id>, with -2, -3 for later versions. */
export const poolIdSchema = z.string().regex(POOL_ID_PATTERN);

/** packs' slugs are nanoids; anything else never reaches an href. */
export const packSlugSchema = z.string().regex(/^[A-Za-z0-9_-]{1,32}$/);

const sha256Schema = z.string().regex(/^[0-9a-f]{64}$/);

/** A past pool's pack: its state, slug, input hash and last answer. */
export const packSyncSchema = z.object({
  slug: packSlugSchema.nullable(),
  state: z.enum(SYNC_STATES).nullable(),
  listed: z.boolean().nullable(),
  /** The input hash packs last answered definitively (created, updated, unchanged, rejected). */
  inputHash: sha256Schema.nullable(),
  syncedAt: z.date().nullable(),
  error: z.string().nullable(),
});

/** A past pool's pack. */
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

/**
 * Who sent a host or community pool, as an admin typed it: a name (1 to 100 characters once
 * trimmed, one line, through the content filter) and maybe an https link. With no link the key
 * is left out: the MongoDB driver would store an undefined value as null, which this refuses.
 */
export const sourceCreditSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Give a name to credit.")
    .max(MAX_CREDIT_NAME_LENGTH, `Keep the name to ${MAX_CREDIT_NAME_LENGTH} characters.`)
    .refine((name) => !/\p{Cc}/u.test(name), "The name can't have line breaks.")
    .refine((name) => !hasBlockedLanguage(name), "The name fails the content filter."),
  url: httpsUrl.optional(),
});

/** A host or community source's credit: a name and maybe an https link. */
export type SourceCreditRecord = z.infer<typeof sourceCreditSchema>;

/** A pool in otdb's export, as v1 stored it. */
const otdbSourceSchema = z.object({
  kind: z.literal("otdb"),
  id: z.string().min(1),
  url: httpsUrl,
  importedAt: z.date(),
});

/** A pool an admin added for a host or a community member. */
const creditedSource = <K extends "host" | "community">(kind: K) =>
  z.object({
    kind: z.literal(kind),
    id: z.string().regex(SOURCE_ID_PATTERN),
    credit: sourceCreditSchema,
    importedAt: z.date(),
  });

const hostSourceSchema = creditedSource("host");
const communitySourceSchema = creditedSource("community");

/** A pool's source: otdb, host or community. */
export const poolSourceSchema = z.discriminatedUnion("kind", [
  otdbSourceSchema,
  hostSourceSchema,
  communitySourceSchema,
]);

/** A pool's source. */
export type PoolSource = z.infer<typeof poolSourceSchema>;

/** A source that pointed here until its pool changed there. */
export const formerSourceSchema = z.discriminatedUnion("kind", [
  otdbSourceSchema.extend({ leftAt: z.date() }),
  hostSourceSchema.extend({ leftAt: z.date() }),
  communitySourceSchema.extend({ leftAt: z.date() }),
]);

/** A source the record lost, with when. */
export type FormerSource = z.infer<typeof formerSourceSchema>;

/** A map as the source listed it: label, beatmap id and the mods it named. */
export const sourceSlotSchema = z.object({
  label: z.string(),
  beatmapId: beatmapIdSchema,
  mods: z.array(z.string()),
});

/** A slot as its source labelled it. */
export type SourceSlotRecord = z.infer<typeof sourceSlotSchema>;

/** A pool's stats from packs. */
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

/** A pool's stats. */
export type PoolStats = z.infer<typeof poolStatsSchema>;

/** Admin overrides: a key that's there wins (round and year may be set to null on purpose). */
export const poolEditsSchema = z.object({
  tournament: z.string().optional(),
  round: z.string().nullable().optional(),
  year: z.number().int().nullable().optional(),
  notes: z.string().optional(),
});

/** An admin's edits over what the name reads. */
export type PoolEdits = z.infer<typeof poolEditsSchema>;

/** A past pool record as stored. */
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

/** A past pool record. */
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
