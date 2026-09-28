/**
 * @file src/schemas/built-pool-ops.ts
 * @desc The pool routes' JSON bodies, all strict: POST /api/pools (a name and details, or a pool
 *       to start from), POST /api/pools/<id>/ops (a base version and 1 to 20 ops), PUT
 *       .../visibility, POST .../editors (an osu! username), POST .../owner (an editor's osu!
 *       id and the pool's name typed to confirm). Each op's fields come from @haruhimemoe/pool's
 *       schemas (beatmap ids, bucket codes, palette colors, forced mod sets), and a bucket's
 *       target and a slot's note (src/schemas/built-plan.ts), and the candidate ops (add, remove,
 *       promote, demote the pick, note, vote, move to another slot of the same bucket); a create
 *       may name a template; every piece of text
 *       a person types and we keep, bucket codes included, goes through the content filter (the
 *       name typed to confirm is only compared, never kept). What an op does to a pool lives in
 *       src/utils/built-ops.ts.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Mon Sep 28, 2026
 */

import {
  BUCKET_CODE_PATTERN,
  beatmapIdSchema,
  MAX_SLOT_INDEX,
  paletteColorSchema,
  storedSlotModsSchema,
} from "@haruhimemoe/pool";
import { hasBlockedLanguage } from "@haruhimemoe/pool/content-filter";
import { z } from "zod";
import {
  MAX_OPS_PER_CALL,
  MAX_PASTE_LENGTH,
  MAX_USERNAME_LENGTH,
  VISIBILITIES,
} from "@/constants/built-pools";
import { MAX_CANDIDATES } from "@/constants/candidates";
import { TEMPLATE_IDS } from "@/constants/targets";
import { slotNoteSchema, targetCountSchema, targetRangeSchema } from "@/schemas/built-plan";
import { builtDetailsFields, FILTER_ISSUE } from "@/schemas/built-pool";
import { poolIdSchema } from "@/schemas/pool";

const codeSchema = z
  .string()
  .regex(BUCKET_CODE_PATTERN, "Slot codes are 1 to 12 letters and digits.")
  .refine((code) => !hasBlockedLanguage(code), FILTER_ISSUE);

/** A bucket code, or null for maps with no slot. */
const bucketSchema = codeSchema.nullable();
const indexSchema = z.number().int().min(1).max(MAX_SLOT_INDEX);
const slotRefSchema = z.strictObject({ bucket: bucketSchema, index: indexSchema });
/** A slot that can hold candidates: always in a bucket. */
const placeSchema = z.strictObject({ bucket: codeSchema, index: indexSchema });
/** Where in a slot's candidate list (0 first); the end when left out. */
const atSchema = z
  .number()
  .int()
  .min(0)
  .max(MAX_CANDIDATES - 1)
  .optional();
/** A map's set (null when its details haven't loaded). */
const setIdSchema = z.number().int().positive().nullable();
const candidateRef = { slot: placeSchema, beatmapId: beatmapIdSchema };

/** The candidate ops (src/utils/candidate-ops.ts applies them). */
const candidateOpSchemas = [
  z.strictObject({
    type: z.literal("addCandidate"),
    ...candidateRef,
    beatmapsetId: setIdSchema,
    note: slotNoteSchema.optional(),
    at: atSchema,
  }),
  z.strictObject({ type: z.literal("removeCandidate"), ...candidateRef }),
  z.strictObject({
    type: z.literal("promoteCandidate"),
    ...candidateRef,
    /** The old pick's set, for its cover once it's a candidate. */
    pickSetId: setIdSchema.optional(),
  }),
  z.strictObject({
    type: z.literal("demotePick"),
    slot: placeSchema,
    beatmapsetId: setIdSchema.optional(),
    at: atSchema,
  }),
  z.strictObject({ type: z.literal("setCandidateNote"), ...candidateRef, note: slotNoteSchema }),
  z.strictObject({ type: z.literal("voteCandidate"), ...candidateRef, on: z.boolean() }),
  z.strictObject({
    type: z.literal("moveCandidate"),
    ...candidateRef,
    to: indexSchema,
    at: atSchema,
  }),
] as const;

/** What a custom bucket's maps are played with: none, forced mods, or freemod. */
export const slotModsSchema = z.union([
  z.strictObject({ kind: z.literal("none") }),
  storedSlotModsSchema,
]);

const detailsOp = z
  .strictObject({
    type: z.literal("setDetails"),
    name: builtDetailsFields.name.optional(),
    tournament: builtDetailsFields.tournament.optional(),
    round: builtDetailsFields.round.optional(),
    year: builtDetailsFields.year.optional(),
    notes: builtDetailsFields.notes.optional(),
  })
  .refine((op) => Object.keys(op).length > 1, "Send a detail to change.");

/** One editor op: maps, buckets, details, targets, notes or candidates. */
export const opSchema = z.union([
  detailsOp,
  z.strictObject({
    type: z.literal("addMap"),
    beatmapId: beatmapIdSchema,
    bucket: bucketSchema,
    index: indexSchema.optional(),
  }),
  z.strictObject({ type: z.literal("removeMap"), slot: slotRefSchema }),
  z.strictObject({
    type: z.literal("moveMap"),
    slot: slotRefSchema,
    bucket: bucketSchema,
    index: indexSchema.optional(),
  }),
  z.strictObject({ type: z.literal("setSlotMods"), bucket: codeSchema, mods: slotModsSchema }),
  z.strictObject({
    type: z.literal("addBucket"),
    code: codeSchema,
    color: paletteColorSchema.optional(),
    mods: slotModsSchema.optional(),
  }),
  z.strictObject({ type: z.literal("removeBucket"), code: codeSchema }),
  z.strictObject({
    type: z.literal("replaceMaps"),
    text: z.string().max(MAX_PASTE_LENGTH, `Paste at most ${MAX_PASTE_LENGTH} characters.`),
    mode: z.enum(["replace", "merge"]).optional(),
  }),
  z.strictObject({
    type: z.literal("setTarget"),
    bucket: codeSchema,
    count: targetCountSchema,
    sr: targetRangeSchema.optional(),
  }),
  z.strictObject({ type: z.literal("setNote"), beatmapId: beatmapIdSchema, note: slotNoteSchema }),
  ...candidateOpSchemas,
]);

/** One editor op. */
export type PoolOp = z.infer<typeof opSchema>;

/** POST /api/pools/<id>/ops: the version it builds on and 1 to 20 ops. */
export const opsBodySchema = z.strictObject({
  baseVersion: z.number().int().positive(),
  ops: z
    .array(opSchema)
    .min(1, "Send at least one change.")
    .max(MAX_OPS_PER_CALL, `Send at most ${MAX_OPS_PER_CALL} changes at once.`),
});

/** POST /api/pools: the details, a template, and the pool to start from. */
export const createPoolBodySchema = z
  .strictObject({
    name: builtDetailsFields.name.optional(),
    tournament: builtDetailsFields.tournament.optional(),
    round: builtDetailsFields.round.optional(),
    year: builtDetailsFields.year.optional(),
    notes: builtDetailsFields.notes.optional(),
    /** A past pool's id, or a built pool the caller can see: its maps are copied. */
    startedFrom: poolIdSchema.optional(),
    /** A template's targets (counts only; never maps). */
    template: z.enum(TEMPLATE_IDS).optional(),
  })
  .refine(
    (body) => body.name !== undefined || body.startedFrom !== undefined,
    "Give the pool a name.",
  );

/** A new pool's request. */
export type CreatePoolBody = z.infer<typeof createPoolBodySchema>;

/** PUT /api/pools/<id>/visibility. */
export const visibilityBodySchema = z.strictObject({ visibility: z.enum(VISIBILITIES) });

/** POST /api/pools/<id>/editors: an osu! username. */
export const editorBodySchema = z.strictObject({
  username: z
    .string()
    .trim()
    .min(1, "Type an osu! username.")
    .max(MAX_USERNAME_LENGTH, "That isn't an osu! username.")
    .regex(/^[A-Za-z0-9 _[\]-]+$/, "That isn't an osu! username."),
});

/** Longer than any pool name, so a wrong one is refused by comparison, not by length. */
const MAX_CONFIRM_LENGTH = 200;

/** POST /api/pools/<id>/owner: the new owner's osu! id and the pool's name, typed. */
export const ownerBodySchema = z.strictObject({
  osuId: z.number().int().positive(),
  confirmName: z.string().max(MAX_CONFIRM_LENGTH),
});
