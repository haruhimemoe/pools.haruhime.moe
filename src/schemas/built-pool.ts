/**
 * @file src/schemas/built-pool.ts
 * @desc A pool built here, as stored in built_pools: @haruhimemoe/pool's slots and buckets
 *       (poolFields with its bucket checks: 64 maps, 8 custom buckets, every slot in a listed
 *       bucket) and no map twice; the details (name 1 to 64 characters, tournament and round up
 *       to 100, notes up to 2000, year from 2007 to next year or none, every text trimmed and
 *       through the content filter, only notes keeping line breaks); who sees it; the owner (a
 *       user id) and up to 10 editors (osu! id and name, the user id once they've signed in);
 *       the version; the pack state (with when a sync last started); moderation; each bucket's
 *       target (only on buckets the pool has) and each slot's note (only on its maps). Nullable fields are stored as null, never
 *       undefined (the driver would write null anyway); `buckets` is left out for the default,
 *       and `targets` and `slotNotes` when there are none.
 *       No text takes a lone surrogate (the driver would store U+FFFD, so the saved text would
 *       differ from the checked one). The filter's refusal carries `params.code` content_filter,
 *       which the routes send as the error code. Writes check the whole stored schema; reads use
 *       builtPoolReadSchema, the same fields by shape only, so a pool a newer filter would refuse
 *       still reads (and can be seen, renamed and deleted).
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Mon Sep 28, 2026
 */

import {
  bucketEntrySchema,
  checkPoolBuckets,
  MAX_NAME_LENGTH,
  poolFields,
  poolSlotSchema,
} from "@haruhimemoe/pool";
import { hasBlockedLanguage } from "@haruhimemoe/pool/content-filter";
import { z } from "zod";
import {
  BUILT_PACK_STATES,
  BUILT_POOL_ID_PATTERN,
  MAX_EDITORS,
  VISIBILITIES,
} from "@/constants/built-pools";
import {
  FIRST_YEAR,
  MAX_NOTES_LENGTH,
  MAX_ROUND_LENGTH,
  MAX_TOURNAMENT_LENGTH,
} from "@/constants/pools";
import {
  bucketTargetsSchema,
  bucketTargetsShape,
  checkSlotNotes,
  checkTargets,
  slotNotesSchema,
  slotNotesShape,
} from "@/schemas/built-plan";
import { packSlugSchema } from "@/schemas/pool";

const FILTERED = "That fails the content filter.";
/** A zod refinement's params for the filter: parseJsonBody sends the code. */
export const FILTER_ISSUE = { message: FILTERED, params: { code: "content_filter" } };
const ONE_LINE = /^[^\p{Cc}]*$/u;
/** With the u flag, \p{Cs} only matches a surrogate that isn't half of a pair. */
const LONE_SURROGATE = /\p{Cs}/u;
const wellFormed = (text: string): boolean => !LONE_SURROGATE.test(text);
/** Notes may hold tabs and line breaks, and no other control character. */
const showable = (text: string): boolean => !/\p{Cc}/u.test(text.replace(/[\t\n\r]/g, ""));

const oneLine = (label: string, min: number, max: number) =>
  z
    .string()
    .trim()
    .min(min, `Give the pool a ${label}.`)
    .max(max, `Keep the ${label} to ${max} characters.`)
    .regex(ONE_LINE, `The ${label} can't have line breaks.`)
    .refine(wellFormed, `The ${label} has a broken character.`)
    .refine((text) => !hasBlockedLanguage(text), FILTER_ISSUE);

/** A built pool's name: one line, 1 to MAX_NAME_LENGTH, through the content filter. */
export const builtNameSchema = oneLine("name", 1, MAX_NAME_LENGTH);
/** Its tournament: one line, up to MAX_TOURNAMENT_LENGTH. */
export const builtTournamentSchema = oneLine("tournament", 0, MAX_TOURNAMENT_LENGTH);
/** Its round: one line, up to MAX_ROUND_LENGTH. */
export const builtRoundSchema = oneLine("round", 0, MAX_ROUND_LENGTH);

/** Its notes: up to MAX_NOTES_LENGTH, through the content filter. */
export const builtNotesSchema = z
  .string()
  .trim()
  .max(MAX_NOTES_LENGTH, `Keep the notes to ${MAX_NOTES_LENGTH} characters.`)
  .refine(showable, "The notes have a character that can't be shown.")
  .refine(wellFormed, "The notes have a broken character.")
  .refine((text) => !hasBlockedLanguage(text), FILTER_ISSUE);

/** Its year: four digits, or null. */
export const builtYearSchema = z
  .number()
  .int("A year is a whole number.")
  .min(FIRST_YEAR, `A year is ${FIRST_YEAR} or later.`)
  .refine((year) => year <= new Date().getUTCFullYear() + 1, "That year hasn't come yet.")
  .nullable();

/** An editor: osu! id, username, their user id once they've signed in, and when they were added. */
export const builtEditorSchema = z.object({
  /** The editor's user id once they've signed in; null until then. */
  userId: z.string().min(1).nullable(),
  osuId: z.number().int().positive(),
  username: z.string().min(1),
  addedAt: z.date(),
});

/** A built pool's editor. */
export type BuiltEditor = z.infer<typeof builtEditorSchema>;

/**
 * The pool's pack on packs. `lastAttemptAt` (the last sync started, at most one per 30 s),
 * `listed` (packs lists it: public and not hidden there), `gone` (packs' moderators removed
 * it: never synced again) and `retry` (a failure a sync tries again by itself; false when packs
 * refused the pool or pools' settings, which waits for the next change or "Update pack now")
 * came with the sync, so older rows read without them.
 */
export const builtPackSchema = z.object({
  state: z.enum(BUILT_PACK_STATES),
  slug: packSlugSchema.nullable(),
  syncedAt: z.date().nullable(),
  error: z.string().nullable(),
  lastAttemptAt: z.date().nullable().default(null),
  listed: z.boolean().default(false),
  gone: z.boolean().default(false),
  retry: z.boolean().default(true),
});

/** A built pool's pack on packs. */
export type BuiltPack = z.infer<typeof builtPackSchema>;

/** The details a person edits, all at once (setDetails sends any of them). */
export const builtDetailsFields = {
  name: builtNameSchema,
  tournament: builtTournamentSchema,
  round: builtRoundSchema,
  year: builtYearSchema,
  notes: builtNotesSchema,
};

/**
 * @function hasDuplicateMaps
 * @param slots {readonly { beatmapId: number }[]} a pool's slots
 * @returns {boolean} true when a beatmap id is in two slots
 */
export const hasDuplicateMaps = (slots: readonly { beatmapId: number }[]): boolean =>
  new Set(slots.map((slot) => slot.beatmapId)).size !== slots.length;

/** What every stored pool has besides its details, slots and buckets. */
const builtPoolRest = {
  _id: z.string().regex(BUILT_POOL_ID_PATTERN),
  visibility: z.enum(VISIBILITIES),
  ownerId: z.string().min(1),
  editors: z.array(builtEditorSchema).max(MAX_EDITORS),
  version: z.number().int().positive(),
  pack: builtPackSchema,
  hidden: z.boolean(),
  startedFrom: z.string().min(1).nullable(),
  /** Each bucket's target (src/schemas/built-plan.ts); left out when there are none. */
  targets: bucketTargetsSchema.optional(),
  /** Each slot's note by beatmap id; left out when there are none. */
  slotNotes: slotNotesSchema.optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
};

/** A built pool as written: content, owner, editors, visibility, pack, version and dates. */
export const storedBuiltPoolSchema = poolFields
  .extend({ ...builtPoolRest, ...builtDetailsFields })
  .superRefine((pool, ctx) => {
    checkPoolBuckets(pool, ctx);
    checkTargets(pool, ctx);
    checkSlotNotes(pool, ctx);
    if (hasDuplicateMaps(pool.slots)) {
      ctx.addIssue({ code: "custom", message: "A map is in the pool twice.", path: ["slots"] });
    }
  });

/** A built pool as stored. */
export type StoredBuiltPool = z.infer<typeof storedBuiltPoolSchema>;

/**
 * A stored pool as read: the same fields by shape only (no length, content filter, bucket or
 * duplicate rules), so a pool that a newer filter or limit would refuse still reads, and its
 * owner can see it, fix it or delete it. Writes still go through storedBuiltPoolSchema.
 */
export const builtPoolReadSchema = z.object({
  ...builtPoolRest,
  editors: z.array(builtEditorSchema),
  name: z.string(),
  tournament: z.string(),
  round: z.string(),
  year: z.number().int().nullable(),
  notes: z.string(),
  slots: z.array(poolSlotSchema),
  buckets: z.array(bucketEntrySchema).optional(),
  targets: bucketTargetsShape.optional(),
  slotNotes: slotNotesShape.optional(),
});
