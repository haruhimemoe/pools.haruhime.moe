/**
 * @file src/utils/source-labels.ts
 * @desc Reading a source pool's slot labels into @haruhimemoe/pool's shape: labels go through
 *       its pasted-pool parsing ("NM1", "HD2", "TB", and custom labels like "HDHR1" or "EZ1",
 *       which become custom slots forcing the mods they spell); plain numbers ("#1", "12") are
 *       maps without a slot; slots stay in the source's order. And what the source's own mods
 *       change: a rating mod every map under a label carries goes into the slot (an EZ
 *       tournament's HD1 is EZHD1), while mods a slot can't hold make the pool unreadable.
 *       Pure.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Mon Sep 28, 2026
 */

import {
  addBuckets,
  bucketsOf,
  changesStarRating,
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
  ratingMods,
  setBucketMods,
  slotKey,
  slotTitle,
} from "@haruhimemoe/pool";
import { slotModsMap } from "@/utils/slot-mods";

/** A map as a source lists it: its label, osu! difficulty id, and the mods it names, if any. */
export type SourceSlot = { label: string; beatmapId: number; mods?: readonly string[] };

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

/** "#1", "12": a numbered map without a slot. */
const NUMBERED = /^#?\s*(\d{1,3})$/u;

/** Labels read into a pool, or the first reason they can't be. */
export type LabelResult = { ok: true; pool: Pool } | { ok: false; reason: string };

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
  // addBuckets puts the slots in bucket order; the source's order is what the mods line up with.
  return { ok: true, pool: { ...pool, slots: ordered } };
};

/** What the source's mods change, or why the pool can't hold them. */
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
  const played = pool.slots.map((_, i) => ratingMods(mods[i] ?? []));
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
    if (!extras.some(changesStarRating)) continue;
    const labels = [...new Set(extras.map(setLabel))];
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
