/**
 * @file src/utils/undo.ts
 * @desc Undo in the editor, the pure side. inverseOf works out the ops that put a pool back as it
 *       was before a change (each op's inverse from the pool just before and just after it, in
 *       reverse order: a removed map comes back at its slot with its note, a removed bucket with
 *       its color, mods and target, a paste as the old slot lines, candidates as
 *       src/utils/candidate-undo.ts says). It then checks them: the
 *       inverse is kept only when applying it gives back exactly the same content and it fits
 *       one ops call; otherwise the change has no undo. The history keeps the last 20 steps and
 *       drops steps whose change was never saved. Pure, and safe in the browser.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { bucketsOf, findBucket, isCustomBucket, type PoolSlot, slotLabel } from "@haruhimemoe/pool";
import { MAX_OPS_PER_CALL } from "@/constants/built-pools";
import type { PoolOp } from "@/schemas/built-pool-ops";
import type { BuiltContent } from "@/utils/built-content";
import { applyOps } from "@/utils/built-ops";
import { type Actor, isCandidateOp, NO_ACTOR } from "@/utils/candidate-ops";
import { candidateInverse, candidatesForUndo } from "@/utils/candidate-undo";

/** Steps the editor can undo. */
export const MAX_UNDO_STEPS = 20;

/** One change that can be undone: its inverse ops, and whether the change saved. */
export type UndoStep = { id: number; ops: PoolOp[]; saved: boolean };

type Op<K extends PoolOp["type"]> = Extract<PoolOp, { type: K }>;

const stable = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stable);
  if (value === null || typeof value !== "object") return value;
  const entries = Object.entries(value).filter(([, v]) => v !== undefined);
  return Object.fromEntries(
    entries.sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, stable(v)]),
  );
};

const canonical = (pool: BuiltContent): string => {
  const { name, tournament, round, year, notes } = pool;
  const slots = [...pool.slots].sort(
    (a, b) => (a.mod ?? "").localeCompare(b.mod ?? "") || a.index - b.index,
  );
  const [targets, slotNotes] = [pool.targets ?? {}, pool.slotNotes ?? {}];
  const buckets = bucketsOf(pool);
  const candidates = candidatesForUndo(pool.candidates);
  return JSON.stringify(
    stable({
      name,
      tournament,
      round,
      year,
      notes,
      buckets,
      slots,
      targets,
      slotNotes,
      candidates,
    }),
  );
};

/**
 * @function sameContent
 * @param a {BuiltContent} a pool
 * @param b {BuiltContent} another
 * @returns {boolean} true when their details, buckets, slots, targets, notes and candidates (by
 *          map, set and note) are the same
 */
export const sameContent = (a: BuiltContent, b: BuiltContent): boolean =>
  canonical(a) === canonical(b);

const ref = (slot: PoolSlot) => ({ bucket: slot.mod, index: slot.index });
const at = (pool: BuiltContent, r: { bucket: string | null; index: number }) =>
  pool.slots.find((slot) => slot.mod === r.bucket && slot.index === r.index);
const slotOf = (pool: BuiltContent, beatmapId: number) =>
  pool.slots.find((slot) => slot.beatmapId === beatmapId);

const noteBack = (pool: BuiltContent, beatmapId: number): PoolOp[] => {
  const note = pool.slotNotes?.[String(beatmapId)];
  return note ? [{ type: "setNote", beatmapId, note }] : [];
};

const targetBack = (pool: BuiltContent, bucket: string): PoolOp => {
  const target = pool.targets?.[bucket];
  return target?.sr
    ? { type: "setTarget", bucket, count: target.count, sr: target.sr }
    : { type: "setTarget", bucket, count: target?.count ?? 0 };
};

const pasteBack = (before: BuiltContent, after: BuiltContent): PoolOp[] => {
  const text = before.slots.map((slot) => `${slotLabel(slot)} ${slot.beatmapId}`).join("\n");
  const had = new Set(bucketsOf(before).map((entry) => entry.code));
  const created = bucketsOf(after).filter((entry) => !had.has(entry.code));
  return [
    { type: "replaceMaps", text, mode: "replace" },
    ...created.map((entry): PoolOp => ({ type: "removeBucket", code: entry.code })),
    ...before.slots.flatMap((slot) => noteBack(before, slot.beatmapId)),
  ];
};

const bucketBack = (before: BuiltContent, code: string): PoolOp[] => {
  const entry = findBucket(bucketsOf(before), code);
  if (!entry || !isCustomBucket(entry)) return [];
  const mods = entry.mods ? { mods: entry.mods } : {};
  return [{ type: "addBucket", code, color: entry.color, ...mods }, targetBack(before, code)];
};

/** One op's inverse, from the pool just before and just after it; null when there's none. */
const inverseStep = (
  before: BuiltContent,
  after: BuiltContent,
  op: PoolOp,
  actor: Actor,
): PoolOp[] | null => {
  if (isCandidateOp(op)) return candidateInverse(before, op, actor);
  switch (op.type) {
    case "setDetails": {
      const keys = Object.keys(op).filter((key) => key !== "type") as (keyof Op<"setDetails">)[];
      return [
        {
          type: "setDetails",
          ...Object.fromEntries(keys.map((k) => [k, before[k as keyof BuiltContent]])),
        },
      ];
    }
    case "addMap": {
      const added = slotOf(after, op.beatmapId);
      return added ? [{ type: "removeMap", slot: ref(added) }] : null;
    }
    case "removeMap": {
      const gone = at(before, op.slot);
      if (!gone) return null;
      const back: PoolOp = {
        type: "addMap",
        beatmapId: gone.beatmapId,
        bucket: gone.mod,
        index: gone.index,
      };
      return [back, ...noteBack(before, gone.beatmapId)];
    }
    case "moveMap": {
      const was = at(before, op.slot);
      const now = was && slotOf(after, was.beatmapId);
      return was && now
        ? [{ type: "moveMap", slot: ref(now), bucket: was.mod, index: was.index }]
        : null;
    }
    case "setSlotMods": {
      const entry = findBucket(bucketsOf(before), op.bucket);
      const mods =
        entry && isCustomBucket(entry) && entry.mods ? entry.mods : { kind: "none" as const };
      return [{ type: "setSlotMods", bucket: op.bucket, mods }];
    }
    case "addBucket":
      return [{ type: "removeBucket", code: op.code }];
    case "removeBucket":
      return bucketBack(before, op.code);
    case "replaceMaps":
      return pasteBack(before, after);
    case "setTarget":
      return [targetBack(before, op.bucket)];
    case "setNote":
      return [
        {
          type: "setNote",
          beatmapId: op.beatmapId,
          note: before.slotNotes?.[String(op.beatmapId)] ?? "",
        },
      ];
  }
};

/**
 * @function inverseOf
 * @param pool {BuiltContent} the pool before a change
 * @param ops {readonly PoolOp[]} the change
 * @param actor {Actor} who made it (a vote's inverse is their old vote)
 * @returns {PoolOp[] | null} the ops that put it back exactly (checked, and within one call), or
 *          null when the change can't be undone
 */
export const inverseOf = (
  pool: BuiltContent,
  ops: readonly PoolOp[],
  actor: Actor = NO_ACTOR,
): PoolOp[] | null => {
  const start = applyOps(pool, [], actor);
  if (!start.ok) return null;
  let current: BuiltContent = start.pool;
  const steps: PoolOp[][] = [];
  for (const op of ops) {
    const next = applyOps(current, [op], actor);
    const inverse = next.ok ? inverseStep(current, next.pool, op, actor) : null;
    if (!next.ok || !inverse) return null;
    steps.unshift(inverse);
    current = next.pool;
  }
  const inverse = steps.flat();
  if (inverse.length === 0 || inverse.length > MAX_OPS_PER_CALL) return null;
  const back = applyOps(current, inverse, actor);
  return back.ok && sameContent(back.pool, start.pool) ? inverse : null;
};

/**
 * @function pushStep
 * @param history {readonly UndoStep[]} the steps so far, oldest first
 * @param step {UndoStep} a new one
 * @returns {UndoStep[]} the last 20 steps with it
 */
export const pushStep = (history: readonly UndoStep[], step: UndoStep): UndoStep[] =>
  [...history, step].slice(-MAX_UNDO_STEPS);

/**
 * @function confirmSteps
 * @param history {readonly UndoStep[]} the steps
 * @param ids {readonly number[]} steps whose change was just saved
 * @returns {UndoStep[]} the steps with those marked saved
 */
export const confirmSteps = (history: readonly UndoStep[], ids: readonly number[]): UndoStep[] =>
  history.map((step) => (ids.includes(step.id) ? { ...step, saved: true } : step));

/**
 * @function dropUnsaved
 * @param history {readonly UndoStep[]} the steps
 * @returns {UndoStep[]} only the steps whose change was saved (after a change was refused)
 */
export const dropUnsaved = (history: readonly UndoStep[]): UndoStep[] =>
  history.filter((step) => step.saved);
