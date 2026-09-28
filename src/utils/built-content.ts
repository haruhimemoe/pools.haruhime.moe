/**
 * @file src/utils/built-content.ts
 * @desc What an ops call changes on a built pool (BuiltContent: the details, buckets, slots,
 *       targets and slot notes) and how an op is refused (OpError, its codes and messages).
 *       Shared by src/utils/built-ops.ts and src/utils/built-plan-ops.ts, so neither imports the
 *       other for them. Pure.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Mon Sep 28, 2026
 */

import {
  MAX_CUSTOM_BUCKETS,
  MAX_SLOT_INDEX,
  MAX_SLOTS,
  type SlotLineError,
} from "@haruhimemoe/pool";
import type { StoredBuiltPool } from "@/schemas/built-pool";

/** What ops change: the details, the buckets, the slots and the targets. */
export type BuiltContent = Pick<
  StoredBuiltPool,
  "name" | "tournament" | "round" | "year" | "notes" | "buckets" | "slots" | "targets" | "slotNotes"
>;

/** Why an op can't apply, as the API's error code. */
export type OpErrorCode =
  | "duplicate"
  | "too_many_maps"
  | "too_many_buckets"
  | "unknown_bucket"
  | "unknown_slot"
  | "slot_full"
  | "bad_bucket_code"
  | "not_custom"
  | "bucket_not_empty"
  | "bad_paste"
  | "content_filter";

/** One op's refusal, before it knows which op it was. */
export class OpError extends Error {
  constructor(
    readonly code: OpErrorCode,
    message: string,
    readonly lines?: SlotLineError[],
  ) {
    super(message);
  }
}

/** An ops call that failed: the first op that couldn't apply, and why. */
export type OpFailure = {
  ok: false;
  code: OpErrorCode;
  message: string;
  /** The index of the op that couldn't apply. */
  op: number;
  lines?: SlotLineError[];
};

/** The messages ops refuse with. */
export const OP_MESSAGES = {
  duplicate: "That map is already in the pool.",
  tooManyMaps: `A pool can have at most ${MAX_SLOTS} maps.`,
  tooManyBuckets: `A pool can have at most ${MAX_CUSTOM_BUCKETS} custom slots.`,
  unknownSlot: "That map isn't in the pool any more.",
  slotFull: `A slot can have at most ${MAX_SLOT_INDEX} maps.`,
  notCustom: "Only custom slots can change their mods or be removed.",
  notEmpty: "Move or remove this slot's maps first.",
  badPaste: "Some lines couldn't be read.",
  filtered: "A slot code fails the content filter.",
} as const;
