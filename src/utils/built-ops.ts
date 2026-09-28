/**
 * @file src/utils/built-ops.ts
 * @desc Applies one ops call to a built pool's content, in order and all or nothing: the result is
 *       the whole new content, or the first op that can't apply with a code and a message
 *       (never a half-changed pool). Maps and buckets are edited through @haruhimemoe/pool
 *       (addBucket, setBucketMods, parsePoolText, planMerge, mergeSlots),
 *       so the result keeps its rules; this adds what the builder needs on top: a slot number to
 *       add or move to, no map twice ("duplicate"), a clear refusal for every limit, and the
 *       plan's ops (src/utils/built-plan-ops.ts: targets and slot notes) and the candidate ops
 *       (src/utils/candidate-ops.ts). Maps are added, removed and moved by slot row
 *       (src/utils/slot-rows.ts), so a slot's candidates stay with it. Pure.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Mon Sep 28, 2026
 */

import {
  addBucket,
  addBuckets,
  BUCKET_CODE_MESSAGES,
  type BucketEntry,
  bucketsOf,
  checkBucketCode,
  findBucket,
  isCustomBucket,
  MAX_CUSTOM_BUCKETS,
  MAX_SLOTS,
  mergeSlots,
  nextFreeColor,
  type Pool,
  parsePoolText,
  planMerge,
  removeBucket,
  setBucketMods,
} from "@haruhimemoe/pool";
import { hasBlockedLanguage } from "@haruhimemoe/pool/content-filter";
import { hasDuplicateMaps } from "@/schemas/built-pool";
import type { PoolOp } from "@/schemas/built-pool-ops";
import { type BuiltContent, OP_MESSAGES, OpError, type OpFailure } from "@/utils/built-content";
import { type PlannedContent, tidyPlan, withNote, withTarget } from "@/utils/built-plan-ops";
import { type Actor, applyCandidateOp, isCandidateOp, NO_ACTOR } from "@/utils/candidate-ops";
import { insertPick, moveRow, removePick, rowsOf } from "@/utils/slot-rows";

/** An ops call's result: the whole new content, or the first op that couldn't apply. */
export type OpResult = { ok: true; pool: PlannedContent } | OpFailure;

type Op<K extends PoolOp["type"]> = Extract<PoolOp, { type: K }>;

const unknownBucket = (code: string) =>
  new OpError("unknown_bucket", `This pool has no slot called ${code}.`);

/** Runs one of @haruhimemoe/pool's edits, keeping the details it doesn't know about. */
const edit = (pool: BuiltContent, change: (pool: Pool) => Pool): BuiltContent => {
  const next = change(pool);
  return { ...pool, slots: next.slots, buckets: next.buckets };
};

const requireBucket = (pool: BuiltContent, code: string | null): void => {
  if (code !== null && !findBucket(bucketsOf(pool), code)) throw unknownBucket(code);
};

/** Puts a map in `bucket` at slot `index` (or the end), moving that bucket's later rows up. */
const insertSlot = (
  pool: BuiltContent,
  bucket: string | null,
  beatmapId: number,
  index: number | undefined,
): BuiltContent => {
  requireBucket(pool, bucket);
  return insertPick(pool, bucket, beatmapId, index);
};

const addMap = (pool: BuiltContent, op: Op<"addMap">): BuiltContent => {
  if (pool.slots.some((slot) => slot.beatmapId === op.beatmapId)) {
    throw new OpError("duplicate", OP_MESSAGES.duplicate);
  }
  if (pool.slots.length >= MAX_SLOTS) throw new OpError("too_many_maps", OP_MESSAGES.tooManyMaps);
  return insertSlot(pool, op.bucket, op.beatmapId, op.index);
};

const findSlot = (pool: BuiltContent, ref: { bucket: string | null; index: number }) => {
  const slot = pool.slots.find((s) => s.mod === ref.bucket && s.index === ref.index);
  if (!slot) throw new OpError("unknown_slot", OP_MESSAGES.unknownSlot);
  return slot;
};

const removeMap = (pool: BuiltContent, { slot }: Op<"removeMap">): BuiltContent => {
  findSlot(pool, slot);
  return removePick(pool, slot);
};

/** Within a bucket the whole row moves; to another bucket the pick goes alone. */
const moveMap = (pool: BuiltContent, op: Op<"moveMap">): BuiltContent => {
  const { beatmapId } = findSlot(pool, op.slot);
  requireBucket(pool, op.bucket);
  if (op.bucket === op.slot.bucket) return moveRow(pool, op.slot, op.index);
  return insertSlot(removePick(pool, op.slot), op.bucket, beatmapId, op.index);
};

const customBucket = (pool: BuiltContent, code: string): BucketEntry => {
  const entry = findBucket(bucketsOf(pool), code);
  if (!entry) throw unknownBucket(code);
  if (!isCustomBucket(entry)) throw new OpError("not_custom", OP_MESSAGES.notCustom);
  return entry;
};

const setSlotMods = (pool: BuiltContent, op: Op<"setSlotMods">): BuiltContent => {
  customBucket(pool, op.bucket);
  return edit(pool, (p) => setBucketMods(p, op.bucket, op.mods));
};

const addCustomBucket = (pool: BuiltContent, op: Op<"addBucket">): BuiltContent => {
  const list = bucketsOf(pool);
  const problem = checkBucketCode(list, op.code);
  if (problem === "full") throw new OpError("too_many_buckets", OP_MESSAGES.tooManyBuckets);
  if (problem) throw new OpError("bad_bucket_code", BUCKET_CODE_MESSAGES[problem]);
  const added = edit(pool, (p) => addBucket(p, op.code, op.color ?? nextFreeColor(list)));
  const { mods } = op;
  if (!mods || mods.kind === "none") return added;
  return edit(added, (p) => setBucketMods(p, op.code, mods));
};

const removeCustomBucket = (pool: BuiltContent, { code }: Op<"removeBucket">): BuiltContent => {
  customBucket(pool, code);
  if (pool.slots.some((slot) => slot.mod === code) || rowsOf(pool, code).size > 0) {
    throw new OpError("bucket_not_empty", OP_MESSAGES.notEmpty);
  }
  return edit(pool, (p) => removeBucket(p, code));
};

/** A pasted pool over the maps (replace) or upserted into them by slot (merge), as packs does. */
const replaceMaps = (pool: BuiltContent, op: Op<"replaceMaps">): BuiltContent => {
  const base = op.mode === "merge" ? pool : { ...pool, slots: [] };
  const { slots, newBuckets, errors } = parsePoolText(op.text, base);
  if (errors.length > 0 && errors.every((error) => error.code === "full")) {
    throw new OpError("too_many_buckets", OP_MESSAGES.tooManyBuckets);
  }
  if (errors.length > 0) throw new OpError("bad_paste", OP_MESSAGES.badPaste, errors);
  const used = new Set(slots.map((slot) => slot.mod));
  const created = newBuckets.filter((bucket) => used.has(bucket.code));
  if (created.some((bucket) => hasBlockedLanguage(bucket.code))) {
    throw new OpError("content_filter", OP_MESSAGES.filtered);
  }
  if (bucketsOf(base).filter(isCustomBucket).length + created.length > MAX_CUSTOM_BUCKETS) {
    throw new OpError("too_many_buckets", OP_MESSAGES.tooManyBuckets);
  }
  const withNew = edit(base, (p) => addBuckets(p, created));
  if (planMerge(withNew.slots, slots, bucketsOf(withNew)).dropped.length > 0) {
    throw new OpError("too_many_maps", OP_MESSAGES.tooManyMaps);
  }
  const merged = edit(withNew, (p) => mergeSlots(p, slots));
  if (hasDuplicateMaps(merged.slots)) throw new OpError("duplicate", OP_MESSAGES.duplicate);
  return merged;
};

const applyOp = (pool: BuiltContent, op: PoolOp, actor: Actor): BuiltContent => {
  if (isCandidateOp(op)) return applyCandidateOp(pool, op, actor);
  switch (op.type) {
    case "setDetails": {
      const { type: _, ...details } = op;
      return { ...pool, ...details };
    }
    case "addMap":
      return addMap(pool, op);
    case "removeMap":
      return removeMap(pool, op);
    case "moveMap":
      return moveMap(pool, op);
    case "setSlotMods":
      return setSlotMods(pool, op);
    case "addBucket":
      return addCustomBucket(pool, op);
    case "removeBucket":
      return removeCustomBucket(pool, op);
    case "replaceMaps":
      return replaceMaps(pool, op);
    case "setTarget":
      requireBucket(pool, op.bucket);
      return { ...pool, targets: withTarget(pool.targets ?? {}, op) };
    case "setNote":
      if (!pool.slots.some((slot) => slot.beatmapId === op.beatmapId)) {
        throw new OpError("unknown_slot", OP_MESSAGES.unknownSlot);
      }
      return { ...pool, slotNotes: withNote(pool.slotNotes ?? {}, op) };
  }
};

/**
 * @function applyOps
 * @param pool {BuiltContent} the pool's current content
 * @param ops {readonly PoolOp[]} the call's ops (already parsed), in order
 * @param actor {Actor} who makes them and when (candidates record both; NO_ACTOR for checks)
 * @returns {OpResult} the whole new content (its targets, notes and candidates always there,
 *          only on buckets and maps it has),
 *          or the first op that couldn't apply (its index, code, message, and the unreadable
 *          lines of a paste)
 * @throws when something other than an op's own refusal goes wrong (a bug)
 */
export const applyOps = (
  pool: BuiltContent,
  ops: readonly PoolOp[],
  actor: Actor = NO_ACTOR,
): OpResult => {
  let current = tidyPlan(pool);
  for (const [index, op] of ops.entries()) {
    try {
      current = tidyPlan(applyOp(current, op, actor));
    } catch (error) {
      if (!(error instanceof OpError)) throw error;
      const { code, message, lines } = error;
      return { ok: false, code, message, op: index, ...(lines ? { lines } : {}) };
    }
  }
  return { ok: true, pool: current };
};
