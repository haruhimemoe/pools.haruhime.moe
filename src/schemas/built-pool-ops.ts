/**
 * @file src/schemas/built-pool-ops.ts
 * @desc The pool routes' JSON bodies, all strict: POST /api/pools (a name and details, or a pool
 *       to start from), POST /api/pools/<id>/ops (a base version and 1 to 20 ops), PUT
 *       .../visibility, POST .../editors (an osu! username), POST .../owner (an editor's osu!
 *       id and the pool's name typed to confirm). Each op's fields come from @haruhimemoe/pool's
 *       schemas (beatmap ids, bucket codes, palette colors, forced mod sets); every piece of text
 *       a person types and we keep, bucket codes included, goes through the content filter (the
 *       name typed to confirm is only compared, never kept). What an op does to a pool lives in
 *       src/utils/built-ops.ts.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

import {
  BUCKET_CODE_PATTERN,
  beatmapIdSchema,
  MAX_SLOT_INDEX,
  paletteColorSchema,
  storedSlotModsSchema,
} from "@haruhimemoe/pool";
import { z } from "zod";
import {
  MAX_OPS_PER_CALL,
  MAX_PASTE_LENGTH,
  MAX_USERNAME_LENGTH,
  VISIBILITIES,
} from "@/constants/built-pools";
import { builtDetailsFields, FILTER_ISSUE } from "@/schemas/built-pool";
import { poolIdSchema } from "@/schemas/pool";
import { hasBlockedLanguage } from "@/utils/content-filter";

const codeSchema = z
  .string()
  .regex(BUCKET_CODE_PATTERN, "Slot codes are 1 to 12 letters and digits.")
  .refine((code) => !hasBlockedLanguage(code), FILTER_ISSUE);

/** A bucket code, or null for maps with no slot. */
const bucketSchema = codeSchema.nullable();
const indexSchema = z.number().int().min(1).max(MAX_SLOT_INDEX);
const slotRefSchema = z.strictObject({ bucket: bucketSchema, index: indexSchema });

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
]);

export type PoolOp = z.infer<typeof opSchema>;

export const opsBodySchema = z.strictObject({
  baseVersion: z.number().int().positive(),
  ops: z
    .array(opSchema)
    .min(1, "Send at least one change.")
    .max(MAX_OPS_PER_CALL, `Send at most ${MAX_OPS_PER_CALL} changes at once.`),
});

export const createPoolBodySchema = z
  .strictObject({
    name: builtDetailsFields.name.optional(),
    tournament: builtDetailsFields.tournament.optional(),
    round: builtDetailsFields.round.optional(),
    year: builtDetailsFields.year.optional(),
    notes: builtDetailsFields.notes.optional(),
    /** A past pool's id, or a built pool the caller can see: its maps are copied. */
    startedFrom: poolIdSchema.optional(),
  })
  .refine(
    (body) => body.name !== undefined || body.startedFrom !== undefined,
    "Give the pool a name.",
  );

export type CreatePoolBody = z.infer<typeof createPoolBodySchema>;

export const visibilityBodySchema = z.strictObject({ visibility: z.enum(VISIBILITIES) });

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

export const ownerBodySchema = z.strictObject({
  osuId: z.number().int().positive(),
  confirmName: z.string().max(MAX_CONFIRM_LENGTH),
});
