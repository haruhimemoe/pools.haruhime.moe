/**
 * @file src/utils/source-pools.ts
 * @desc Source pools to pool records, for any source. Slot labels go through @haruhimemoe/pool's
 *       pasted-pool parsing ("NM1", "HD2", "TB", and custom labels like "HDHR1" or "EZ1", which
 *       become custom slots forcing the mods they spell); plain numbers ("#1", "12") are maps
 *       without a slot. When the source lists each map's mods, a rating mod every map under a
 *       label carries goes into the slot (an EZ tournament's HD1 is EZHD1), and a pool whose
 *       no-mod slots mix mods, or whose maps without a slot carry mods, is skipped rather than
 *       stored as no mod. The name, every label and the notes go through the content filter. A
 *       pool that fails any check is skipped with a reason, never half-imported. Each pool gets
 *       the canonical @haruhimemoe/pool shape (buckets only when not the default) and its
 *       fingerprint. Server code only (node:crypto through the fingerprint).
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import {
  addBuckets,
  bucketsOf,
  isModAcronym,
  isModBucket,
  MAX_SLOT_INDEX,
  MOD_ACRONYMS,
  type ModAcronym,
  modSetProblem,
  modsLabel,
  type Pool,
  type PoolSlot,
  parsePoolText,
  poolSchema,
  setBucketMods,
  slotKey,
  slotTitle,
} from "@haruhimemoe/pool";
import { MAX_NOTES_LENGTH, type SourceKind } from "@/constants/pools";
import type { SourceSlotRecord } from "@/schemas/pool";
import { hasBlockedLanguage } from "@/utils/content-filter";
import { poolFingerprint } from "@/utils/fingerprint";
import { slotModsMap } from "@/utils/slot-mods";

/** One pool at one source. */
export type SourceRef = { kind: SourceKind; id: string; url: string };

/** A map as a source lists it: its label, osu! difficulty id, and the mods it names, if any. */
export type SourceSlot = { label: string; beatmapId: number; mods?: readonly string[] };

/** A pool as a source gives it. */
export type SourcePool = {
  source: SourceRef;
  name: string;
  notes: string;
  slots: readonly SourceSlot[];
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

/**
 * @function modsFromSlotCode
 * @param code {string} a custom slot code ("HDHR", "EZ", "DTHD")
 * @returns {ModAcronym[] | null} the mods it spells in canonical order, when the whole code is
 *          acronyms that can be forced together; null otherwise ("SV", "EZHR", "HDHD")
 */
export const modsFromSlotCode = (code: string): ModAcronym[] | null => {
  const upper = code.toUpperCase();
  if (!/^(?:[A-Z]{2})+$/u.test(upper)) return null;
  const pairs: string[] = upper.match(/[A-Z]{2}/gu) ?? [];
  if (!pairs.every((pair) => isModAcronym(pair))) return null;
  const set = MOD_ACRONYMS.filter((mod) => pairs.includes(mod));
  if (set.length !== pairs.length) return null;
  return modSetProblem(set) === null ? set : null;
};

/** Mods that change a map's star rating, as sources write them: NC is DT, DC is HT. */
const RATING_MODS: Readonly<Record<string, ModAcronym>> = Object.freeze({
  EZ: "EZ",
  HR: "HR",
  DT: "DT",
  NC: "DT",
  HT: "HT",
  DC: "HT",
  FL: "FL",
});

/**
 * @function ratingModsOf
 * @param mods {readonly string[]} a map's mods as its source writes them ("ez", "NC", "HD")
 * @returns {ModAcronym[]} the ones that change its star rating, in canonical order
 */
export const ratingModsOf = (mods: readonly string[]): ModAcronym[] => {
  const found = new Set(mods.flatMap((mod) => RATING_MODS[mod.toUpperCase()] ?? []));
  return MOD_ACRONYMS.filter((mod) => found.has(mod));
};

/** "#1", "12": a numbered map without a slot. */
const NUMBERED = /^#?\s*(\d{1,3})$/u;

type LabelResult = { ok: true; pool: Pool } | { ok: false; reason: string };

/**
 * @function poolFromLabels
 * @param name {string} the pool's name
 * @param slots {readonly SourceSlot[]} its maps, in the source's order
 * @param force {ReadonlyMap<string, readonly ModAcronym[]>} mods to force on custom codes that
 *        spell none (from checkSourceMods)
 * @returns {LabelResult} the pool (slots in the source's order, custom slots with the mods their
 *          codes spell or `force` gives), or the first reason it can't be read
 */
export const poolFromLabels = (
  name: string,
  slots: readonly SourceSlot[],
  force: ReadonlyMap<string, readonly ModAcronym[]> = new Map(),
): LabelResult => {
  const fail = (reason: string): LabelResult => ({ ok: false, reason });
  const lines: string[] = [];
  const labels: string[] = [];
  for (const { label, beatmapId } of slots) {
    const text = label.trim();
    if (text === "") return fail("A map has no slot label.");
    if (/[\r\n]/u.test(text))
      return fail(`The slot label ${JSON.stringify(text)} has a line break.`);
    if (NUMBERED.test(text)) continue;
    lines.push(`${text} ${beatmapId}`);
    labels.push(text);
  }
  const parsed = parsePoolText(lines.join("\n"), { slots: [] });
  const [error] = parsed.errors;
  if (error) return fail(`Slot ${labels[error.line - 1] ?? error.text}: ${error.reason}`);
  // A label the parser reads as a comment ("#A") gives no slot and no error.
  if (parsed.slots.length !== lines.length) return fail("A slot label couldn't be read.");

  const ordered: PoolSlot[] = [];
  let next = 0;
  for (const { label, beatmapId } of slots) {
    const number = NUMBERED.exec(label.trim());
    if (!number) {
      const slot = parsed.slots[next++];
      if (slot) ordered.push(slot);
      continue;
    }
    const index = Number(number[1]);
    if (index < 1 || index > MAX_SLOT_INDEX) {
      return fail(`Slot ${label.trim()}: slot numbers go from 1 to ${MAX_SLOT_INDEX}.`);
    }
    ordered.push({ mod: null, index, beatmapId });
  }
  const seen = new Set<string>();
  for (const slot of ordered) {
    if (seen.has(slotKey(slot))) return fail(`${slotTitle(slot)} appears more than once.`);
    seen.add(slotKey(slot));
  }

  let pool: Pool = addBuckets({ name, slots: ordered }, parsed.newBuckets);
  for (const bucket of parsed.newBuckets) {
    const set = modsFromSlotCode(bucket.code) ?? force.get(bucket.code);
    if (set) pool = setBucketMods(pool, bucket.code, { kind: "forced", set: [...set] });
  }
  return { ok: true, pool };
};

type ModsCheck =
  | { ok: true; relabel: Map<number, string>; force: Map<string, ModAcronym[]> }
  | { ok: false; reason: string };

const setLabel = (set: readonly ModAcronym[]): string => (set.length === 0 ? "NM" : modsLabel(set));

/**
 * @function checkSourceMods
 * @param pool {Pool} the pool as its labels read (slots in the source's order)
 * @param mods {readonly (readonly string[])[]} each map's mods at the source, in the same order
 * @returns {ModsCheck} what the source's mods change, or why the pool can't be held. Per label
 *          (maps without a slot are one group; free mod slots are left alone), a rating mod the
 *          label doesn't force is "extra". When every map under a label has the same extra mods,
 *          and there are two or more maps or every map in the pool carries them (one map alone
 *          could be otdb's entry from another pool), they go into the slot. Otherwise a label
 *          that spells mods decides, while a no-mod custom label or maps without a slot with
 *          extra mods can't be held, so the pool is skipped.
 */
export const checkSourceMods = (pool: Pool, mods: readonly (readonly string[])[]): ModsCheck => {
  const played = pool.slots.map((_, i) => ratingModsOf(mods[i] ?? []));
  const everywhere = MOD_ACRONYMS.filter((mod) => played.every((set) => set.includes(mod)));
  const slotMods = slotModsMap(pool.slots, bucketsOf(pool));
  const groups = new Map<string | null, number[]>();
  pool.slots.forEach((slot, i) => {
    groups.set(slot.mod, [...(groups.get(slot.mod) ?? []), i]);
  });
  const relabel = new Map<number, string>();
  const force = new Map<string, ModAcronym[]>();
  for (const [code, members] of groups) {
    const first = pool.slots[members[0] ?? 0];
    const own = first ? slotMods.get(slotKey(first)) : undefined;
    if (own?.kind === "free") continue;
    const forced = own?.kind === "forced" ? own.set : [];
    const extras = members.map((i) => (played[i] ?? []).filter((mod) => !forced.includes(mod)));
    const labels = [...new Set(extras.map(setLabel))];
    if (labels.length === 1 && labels[0] === "NM") continue;
    const extra = extras[0] ?? [];
    const shared =
      labels.length === 1 &&
      (members.length >= 2 || extra.every((mod) => everywhere.includes(mod)));
    if (code === null) {
      return {
        ok: false,
        reason: `Maps without a slot are played with mods (${labels.join(", ")}), which a map without a slot can't hold.`,
      };
    }
    const spellsMods = isModBucket(code) || forced.length > 0;
    if (!shared) {
      if (spellsMods) continue;
      return {
        ok: false,
        reason: `Slot ${code}: its maps are played with different mods (${labels.join(", ")}), which one slot can't hold.`,
      };
    }
    if (!spellsMods) {
      force.set(code, extra);
      continue;
    }
    const set = MOD_ACRONYMS.filter((mod) => forced.includes(mod) || extra.includes(mod));
    if (modSetProblem(set) !== null) {
      return {
        ok: false,
        reason: `Slot ${code}: its maps are played with ${modsLabel(extra)} too, and ${modsLabel(set)} can't be forced together.`,
      };
    }
    for (const i of members) {
      const slot = pool.slots[i];
      if (slot) relabel.set(i, `${modsLabel(set)}${slot.index}`);
    }
  }
  return { ok: true, relabel, force };
};

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

  let labelled = poolFromLabels(pool.name, pool.slots);
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

/** Numeric ids in number order, then everything else in text order. */
const byId = (a: { id: string }, b: { id: string }): number => {
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
  ordered.sort((a, b) => byId(a.pool.source, b.pool.source) || a.position - b.position);
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
