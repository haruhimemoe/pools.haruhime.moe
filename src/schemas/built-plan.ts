/**
 * @file src/schemas/built-plan.ts
 * @desc What a built pool plans besides its maps: each bucket's target (a count of 0 to 16 and
 *       an optional star range, 0 to 10 with the low end at most the high end), keyed by bucket
 *       code; and each slot's note (0 to 280 characters on one line, through the content filter,
 *       its refusal coded content_filter), keyed by beatmap id so it follows the map when it
 *       moves. Each is stored only when there's one; every key names a bucket or map the pool
 *       has. Reads check shape only; `passingNotes` keeps the notes a write would take today,
 *       for anyone who can't edit the pool and for Start from.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { type BucketEntry, bucketsOf, findBucket } from "@haruhimemoe/pool";
import { hasBlockedLanguage } from "@haruhimemoe/pool/content-filter";
import { z } from "zod";
import {
  MAX_SLOT_NOTE_LENGTH,
  MAX_TARGET_COUNT,
  TARGET_MESSAGES,
  TARGET_STARS,
} from "@/constants/targets";

const starSchema = z.number().min(TARGET_STARS.min).max(TARGET_STARS.max);

/** How many maps a bucket should have: 0 to MAX_TARGET_COUNT. */
export const targetCountSchema = z.number().int().min(0).max(MAX_TARGET_COUNT);

/** A bucket's star range: min at most max, both within the star slider. */
export const targetRangeSchema = z
  .strictObject({ min: starSchema, max: starSchema })
  .refine((sr) => sr.min <= sr.max, TARGET_MESSAGES.crossed);

/** A bucket's star range. */
export type TargetRange = z.infer<typeof targetRangeSchema>;

/** A bucket's target: a map count and maybe a star range. */
export const bucketTargetSchema = z.strictObject({
  count: targetCountSchema,
  sr: targetRangeSchema.optional(),
});

/** A bucket's target. */
export type BucketTarget = z.infer<typeof bucketTargetSchema>;

/** Targets by bucket code. */
export const bucketTargetsSchema = z.record(z.string(), bucketTargetSchema);

/** Each bucket's target, by code. */
export type BucketTargets = Readonly<Record<string, BucketTarget>>;

/** Targets as read: shape only, so a stored pool a newer limit would refuse still reads. */
export const bucketTargetsShape = z.record(
  z.string(),
  z.object({
    count: z.number(),
    sr: z.object({ min: z.number(), max: z.number() }).optional(),
  }),
);

/**
 * @function checkTargets
 * @param pool {{ buckets?: BucketEntry[]; targets?: BucketTargets }} a parsed pool
 * @param ctx {z.RefinementCtx} zod refinement context
 * @returns {void} adds an issue for a target on a bucket the pool doesn't have
 */
export const checkTargets = (
  pool: { buckets?: readonly BucketEntry[] | undefined; targets?: BucketTargets | undefined },
  ctx: z.RefinementCtx,
): void => {
  const list = bucketsOf(pool);
  for (const code of Object.keys(pool.targets ?? {})) {
    if (!findBucket(list, code)) {
      ctx.addIssue({ code: "custom", message: `No slot ${code} to aim for.`, path: ["targets"] });
    }
  }
};

/** A slot's note: "" clears it. One line, through the content filter. */
export const slotNoteSchema = z
  .string()
  .trim()
  .max(MAX_SLOT_NOTE_LENGTH, `Keep a note to ${MAX_SLOT_NOTE_LENGTH} characters.`)
  // Control characters, and the line and paragraph separators (U+2028, U+2029).
  .regex(/^[^\p{Cc}\p{Zl}\p{Zp}]*$/u, "A note can't have line breaks.")
  .refine((text) => !/\p{Cs}/u.test(text), "The note has a broken character.")
  .refine((text) => !hasBlockedLanguage(text), {
    message: "That fails the content filter.",
    params: { code: "content_filter" },
  });

/** Notes by beatmap id (as a string key). */
export const slotNotesSchema = z.record(z.string().regex(/^\d+$/), slotNoteSchema.min(1));

/** Each slot's note, by beatmap id. */
export type SlotNotes = Readonly<Record<string, string>>;

/** Notes as read: shape only. */
export const slotNotesShape = z.record(z.string(), z.string());

/**
 * @function passingNotes
 * @param notes {Readonly<Record<string, string>>} notes as stored (read by shape only)
 * @returns {SlotNotes} only those a write would take today: a stored note a newer content filter
 *          or rule refuses isn't shown to anyone who can't edit the pool, or copied to a new one
 */
export const passingNotes = (notes: Readonly<Record<string, string>>): SlotNotes =>
  Object.fromEntries(
    Object.entries(notes).filter(
      ([id, text]) =>
        /^\d+$/.test(id) && slotNoteSchema.min(1).safeParse(text).success && text === text.trim(),
    ),
  );

/**
 * @function checkSlotNotes
 * @param pool {{ slots: { beatmapId: number }[]; slotNotes?: SlotNotes }} a parsed pool
 * @param ctx {z.RefinementCtx} zod refinement context
 * @returns {void} adds an issue for a note on a map the pool doesn't have
 */
export const checkSlotNotes = (
  pool: { slots: readonly { beatmapId: number }[]; slotNotes?: SlotNotes | undefined },
  ctx: z.RefinementCtx,
): void => {
  const ids = new Set(pool.slots.map((slot) => String(slot.beatmapId)));
  for (const id of Object.keys(pool.slotNotes ?? {})) {
    if (!ids.has(id)) {
      ctx.addIssue({
        code: "custom",
        message: "A note is on a map that isn't here.",
        path: ["slotNotes"],
      });
    }
  }
};
