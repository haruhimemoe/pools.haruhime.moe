/**
 * @file src/utils/built-plan-ops.ts
 * @desc The ops on what a built pool plans besides its maps: setTarget (a bucket's count and
 *       optional star range; a count of 0 with no range clears it), and the tidy-up after every
 *       op, which drops targets on buckets the pool no longer has. Pure; src/utils/built-ops.ts
 *       runs them.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { bucketsOf, findBucket } from "@haruhimemoe/pool";
import type { BucketTarget, BucketTargets } from "@/schemas/built-plan";
import type { PoolOp } from "@/schemas/built-pool-ops";
import type { BuiltContent } from "@/utils/built-ops";

type SetTarget = Extract<PoolOp, { type: "setTarget" }>;

/** Content with its plan always there (empty when there's none). */
export type PlannedContent = BuiltContent & { targets: BucketTargets };

/**
 * @function withTarget
 * @param targets {BucketTargets} the pool's targets
 * @param op {SetTarget} the change (its bucket already checked)
 * @returns {BucketTargets} the targets with that bucket's set, or cleared for count 0, no range
 */
export const withTarget = (targets: BucketTargets, op: SetTarget): BucketTargets => {
  const { [op.bucket]: _, ...rest } = targets;
  if (op.count === 0 && !op.sr) return rest;
  const target: BucketTarget = op.sr ? { count: op.count, sr: op.sr } : { count: op.count };
  return { ...rest, [op.bucket]: target };
};

/**
 * @function tidyPlan
 * @param pool {BuiltContent} content after an op
 * @returns {PlannedContent} the same content with only targets on buckets it has
 */
export const tidyPlan = (pool: BuiltContent): PlannedContent => {
  const list = bucketsOf(pool);
  const targets = Object.fromEntries(
    Object.entries(pool.targets ?? {}).filter(([code]) => findBucket(list, code)),
  );
  return { ...pool, targets };
};
