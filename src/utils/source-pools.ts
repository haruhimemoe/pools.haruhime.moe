/**
 * @file src/utils/source-pools.ts
 * @desc Source pools to pool records, for any source. Labels and the source's own mods are
 *       read by src/utils/source-labels.ts; this checks the rest. The name, every label and the
 *       notes go through the content filter. A pool that fails any check is skipped with a
 *       reason, never half-imported. Each pool gets the canonical @haruhimemoe/pool shape
 *       (buckets only when not the default) and its fingerprint. A pool that comes with its
 *       shape (a pack key's) is taken as is. A source is otdb's (its id and link) or a host or
 *       community pool an admin added (a generated id and its credit); either way it rides
 *       along unchanged. Server code only (node:crypto through the fingerprint).
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Mon Sep 28, 2026
 */

import { type Pool, poolSchema } from "@haruhimemoe/pool";
import { hasBlockedLanguage } from "@haruhimemoe/pool/content-filter";
import { MAX_NOTES_LENGTH, type SourceKind } from "@/constants/pools";
import type { PoolSource, SourceSlotRecord } from "@/schemas/pool";
import { type PoolShape, poolFingerprint } from "@/utils/fingerprint";
import {
  checkSourceMods,
  type LabelResult,
  poolFromLabels,
  type SourceSlot,
} from "@/utils/source-labels";

/** One pool at one source: a stored source without its importedAt. */

export type SourceRef = PoolSource extends infer S
  ? S extends PoolSource
    ? Omit<S, "importedAt">
    : never
  : never;

/** A map as a source lists it: its label, osu! difficulty id, and the mods it names, if any. */

/** A pool as a source gives it. */

export type SourcePool = {
  source: SourceRef;
  name: string;
  notes: string;
  slots: readonly SourceSlot[];
  /**
   * The pool already in @haruhimemoe/pool's shape (a pack key's, custom slot mods included):
   * used as is instead of reading the labels, which then only name the maps.
   */
  shape?: PoolShape;
};

/** A pool ready to become (or match) a pool record. */

export type NormalizedPool = {
  source: SourceRef;
  name: string;
  notes: string;
  sourceSlots: SourceSlotRecord[];
  pool: Pool;
  fingerprint: string;
};

/** A pool the import leaves out, and why. */

export type SkippedPool = { kind: SourceKind; id: string; name: string; reason: string };

/** "#1", "12": a numbered map without a slot. */

/**
 * @function normalizeNotes
 * @param text {string} a source's description
 * @returns {string} line breaks as \n, control characters other than line breaks and tabs
 *          removed, trimmed
 */
export const normalizeNotes = (text: string): string =>
  text
    .replace(/\r\n?/gu, "\n")
    .replace(/\p{Cc}/gu, (char) => (char === "\n" || char === "\t" ? char : ""))
    .trim();

type NormalizeResult = { ok: true; pool: NormalizedPool } | { ok: false; skipped: SkippedPool };

/**
 * @function normalizePool
 * @param pool {SourcePool} a pool as its source gives it
 * @returns {NormalizeResult} the normalized pool, or why it's skipped: control characters in the
 *          name, a name, label or notes the content filter refuses, no maps, notes over
 *          MAX_NOTES_LENGTH, labels that don't read, source mods that can't be held, or a pool
 *          @haruhimemoe/pool refuses (a name over 64 characters, more than 64 maps...)
 */
export const normalizePool = (pool: SourcePool): NormalizeResult => {
  const skip = (reason: string): NormalizeResult => ({
    ok: false,
    skipped: { kind: pool.source.kind, id: pool.source.id, name: pool.name, reason },
  });
  if (/\p{Cc}/u.test(pool.name)) return skip("The pool name has control characters.");
  if (hasBlockedLanguage(pool.name)) return skip("The pool name fails the content filter.");
  if (pool.slots.length === 0) return skip("The pool has no maps.");
  if (pool.slots.some((slot) => hasBlockedLanguage(slot.label))) {
    return skip("A slot label fails the content filter.");
  }
  const notes = normalizeNotes(pool.notes);
  if (notes.length > MAX_NOTES_LENGTH) {
    return skip(`The notes are longer than ${MAX_NOTES_LENGTH} characters.`);
  }
  if (hasBlockedLanguage(notes)) return skip("The notes fail the content filter.");

  let labelled: LabelResult = pool.shape
    ? {
        ok: true,
        pool: {
          name: pool.name,
          slots: [...pool.shape.slots],
          ...(pool.shape.buckets ? { buckets: [...pool.shape.buckets] } : {}),
        },
      }
    : poolFromLabels(pool.name, pool.slots);
  if (!labelled.ok) return skip(labelled.reason);
  // What the source says the maps were played with, when it says it for every map.
  const sourceMods = pool.slots.flatMap((slot) => (slot.mods ? [slot.mods] : []));
  if (sourceMods.length === pool.slots.length) {
    const check = checkSourceMods(labelled.pool, sourceMods);
    if (!check.ok) return skip(check.reason);
    if (check.relabel.size > 0 || check.force.size > 0) {
      const relabelled = pool.slots.map((slot, i) => ({
        ...slot,
        label: check.relabel.get(i) ?? slot.label,
      }));
      labelled = poolFromLabels(pool.name, relabelled, check.force);
      if (!labelled.ok) return skip(labelled.reason);
    }
  }
  const checked = poolSchema.safeParse(labelled.pool);
  if (!checked.success) {
    const [issue] = checked.error.issues;
    return skip(
      issue ? `${issue.path.join(".") || "pool"}: ${issue.message}` : "The pool isn't valid.",
    );
  }
  const canonical = checked.data;
  return {
    ok: true,
    pool: {
      source: pool.source,
      name: canonical.name,
      notes,
      sourceSlots: pool.slots.map(({ label, beatmapId, mods }) => ({
        label: label.trim(),
        beatmapId,
        mods: [...(mods ?? [])],
      })),
      pool: canonical,
      fingerprint: poolFingerprint(canonical),
    },
  };
};

/**
 * @function bySourceId
 * @param a {{ id: string }} a pool at a source
 * @param b {{ id: string }} another
 * @returns {number} negative when a comes first: numeric ids (otdb's) in number order, then
 *          everything else in text order. Generated ids start with a letter, so a host or
 *          community pool never sorts ahead of an otdb pool and takes over a merged record's name.
 */
export const bySourceId = (a: { id: string }, b: { id: string }): number => {
  const [x, y] = [Number(a.id), Number(b.id)];
  const xNumber = Number.isInteger(x);
  const yNumber = Number.isInteger(y);
  if (xNumber && yNumber) return x - y;
  if (xNumber !== yNumber) return xNumber ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
};

/**
 * @function normalizePools
 * @param pools {readonly SourcePool[]} one source's pools
 * @returns {{ pools: NormalizedPool[]; skipped: SkippedPool[] }} the pools that normalize, in id
 *          order (lowest id first, so it wins a pool's name when two sources are the same pool),
 *          and the rest with reasons; a pool id the source lists twice keeps its first entry
 */
export const normalizePools = (
  pools: readonly SourcePool[],
): { pools: NormalizedPool[]; skipped: SkippedPool[] } => {
  const normalized: NormalizedPool[] = [];
  const skipped: SkippedPool[] = [];
  const seen = new Set<string>();
  const ordered = pools.map((pool, position) => ({ pool, position }));
  ordered.sort((a, b) => bySourceId(a.pool.source, b.pool.source) || a.position - b.position);
  for (const { pool } of ordered) {
    if (seen.has(pool.source.id)) {
      skipped.push({
        kind: pool.source.kind,
        id: pool.source.id,
        name: pool.name,
        reason: "The source lists this pool id twice; the first one was used.",
      });
      continue;
    }
    seen.add(pool.source.id);
    const result = normalizePool(pool);
    if (result.ok) normalized.push(result.pool);
    else skipped.push(result.skipped);
  }
  return { pools: normalized, skipped };
};
