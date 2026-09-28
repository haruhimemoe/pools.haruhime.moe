/**
 * @file src/schemas/built-pool.ts
 * @desc A pool built here, as stored in built_pools: @haruhimemoe/pool's slots and buckets
 *       (poolFields with its bucket checks: 64 maps, 8 custom buckets, every slot in a listed
 *       bucket) and no map twice; the details (name 1 to 64 characters, tournament and round up
 *       to 100, notes up to 2000, year from 2007 to next year or none, every text trimmed and
 *       through the content filter, only notes keeping line breaks); who sees it; the owner (a
 *       user id) and up to 10 editors (osu! id and name, the user id once they've signed in);
 *       the version; the pack state; moderation. Nullable fields are stored as null, never
 *       undefined (the driver would write null anyway); `buckets` is left out for the default.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

import { checkPoolBuckets, MAX_NAME_LENGTH, poolFields } from "@haruhimemoe/pool";
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
import { packSlugSchema } from "@/schemas/pool";
import { hasBlockedLanguage } from "@/utils/content-filter";

const FILTERED = "That fails the content filter.";
const ONE_LINE = /^[^\p{Cc}]*$/u;
/** Notes may hold tabs and line breaks, and no other control character. */
const showable = (text: string): boolean => !/\p{Cc}/u.test(text.replace(/[\t\n\r]/g, ""));

const oneLine = (label: string, min: number, max: number) =>
  z
    .string()
    .trim()
    .min(min, `Give the pool a ${label}.`)
    .max(max, `Keep the ${label} to ${max} characters.`)
    .regex(ONE_LINE, `The ${label} can't have line breaks.`)
    .refine((text) => !hasBlockedLanguage(text), FILTERED);

export const builtNameSchema = oneLine("name", 1, MAX_NAME_LENGTH);
export const builtTournamentSchema = oneLine("tournament", 0, MAX_TOURNAMENT_LENGTH);
export const builtRoundSchema = oneLine("round", 0, MAX_ROUND_LENGTH);

export const builtNotesSchema = z
  .string()
  .trim()
  .max(MAX_NOTES_LENGTH, `Keep the notes to ${MAX_NOTES_LENGTH} characters.`)
  .refine(showable, "The notes have a character that can't be shown.")
  .refine((text) => !hasBlockedLanguage(text), FILTERED);

export const builtYearSchema = z
  .number()
  .int("A year is a whole number.")
  .min(FIRST_YEAR, `A year is ${FIRST_YEAR} or later.`)
  .refine((year) => year <= new Date().getUTCFullYear() + 1, "That year hasn't come yet.")
  .nullable();

export const builtEditorSchema = z.object({
  /** The editor's user id once they've signed in; null until then. */
  userId: z.string().min(1).nullable(),
  osuId: z.number().int().positive(),
  username: z.string().min(1),
  addedAt: z.date(),
});

export type BuiltEditor = z.infer<typeof builtEditorSchema>;

export const builtPackSchema = z.object({
  state: z.enum(BUILT_PACK_STATES),
  slug: packSlugSchema.nullable(),
  syncedAt: z.date().nullable(),
  error: z.string().nullable(),
});

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

export const storedBuiltPoolSchema = poolFields
  .extend({
    _id: z.string().regex(BUILT_POOL_ID_PATTERN),
    ...builtDetailsFields,
    visibility: z.enum(VISIBILITIES),
    ownerId: z.string().min(1),
    editors: z.array(builtEditorSchema).max(MAX_EDITORS),
    version: z.number().int().positive(),
    pack: builtPackSchema,
    hidden: z.boolean(),
    startedFrom: z.string().min(1).nullable(),
    createdAt: z.date(),
    updatedAt: z.date(),
  })
  .superRefine((pool, ctx) => {
    checkPoolBuckets(pool, ctx);
    if (hasDuplicateMaps(pool.slots)) {
      ctx.addIssue({ code: "custom", message: "A map is in the pool twice.", path: ["slots"] });
    }
  });

export type StoredBuiltPool = z.infer<typeof storedBuiltPoolSchema>;
