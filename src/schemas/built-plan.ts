/**
 * @file src/schemas/built-plan.ts
 * @desc What a built pool plans besides its maps: each bucket's target (a count of 0 to 16 and
 *       an optional star range, 0 to 10 with the low end at most the high end), keyed by bucket
 *       code. Stored only when there's one; every key names a bucket the pool has.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { type BucketEntry, bucketsOf, findBucket } from "@haruhimemoe/pool";
import { z } from "zod";
import { MAX_TARGET_COUNT, TARGET_MESSAGES, TARGET_STARS } from "@/constants/targets";

const starSchema = z.number().min(TARGET_STARS.min).max(TARGET_STARS.max);

export const targetCountSchema = z.number().int().min(0).max(MAX_TARGET_COUNT);

export const targetRangeSchema = z
  .strictObject({ min: starSchema, max: starSchema })
  .refine((sr) => sr.min <= sr.max, TARGET_MESSAGES.crossed);

export type TargetRange = z.infer<typeof targetRangeSchema>;

export const bucketTargetSchema = z.strictObject({
  count: targetCountSchema,
  sr: targetRangeSchema.optional(),
});

export type BucketTarget = z.infer<typeof bucketTargetSchema>;

/** Targets by bucket code. */
export const bucketTargetsSchema = z.record(z.string(), bucketTargetSchema);

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
