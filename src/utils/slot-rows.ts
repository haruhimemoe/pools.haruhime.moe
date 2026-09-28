/**
 * @file src/utils/slot-rows.ts
 * @desc A bucket's slots as rows: a row is a slot number with a pick, candidates, or both. Adding,
 *       removing and moving maps work on rows so candidates stay with their slot: removing a
 *       pick leaves its row when it has candidates (the slot stays, with no pick) and closes the
 *       bucket up only when nothing is left; adding to a row with candidates and no pick fills
 *       it; adding onto a row that has a pick moves that row and the later ones up by one;
 *       moving within a bucket moves the whole row, candidates included; moving to another
 *       bucket takes the pick alone (candidates are judged under their bucket's mods). With no
 *       candidates anywhere this is exactly what the builder did before. Pure.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import {
  bucketsOf,
  MAX_SLOT_INDEX,
  nextSlotIndex,
  type PoolSlot,
  sortSlots,
} from "@haruhimemoe/pool";
import { type Candidate, candidateKey, placeOfKey } from "@/schemas/built-candidates";
import { type BuiltContent, OP_MESSAGES, OpError } from "@/utils/built-content";

/** One slot number's pick (or null) and candidates (or none). */
export type SlotRow = { pick: number | null; list: Candidate[] };

type Rows = Map<number, SlotRow>;

/**
 * @function rowsOf
 * @param pool {BuiltContent} a pool
 * @param bucket {string | null} one of its buckets (null: maps with no slot, never candidates)
 * @returns {Map<number, SlotRow>} its rows by slot number
 */
export const rowsOf = (pool: BuiltContent, bucket: string | null): Rows => {
  const rows: Rows = new Map();
  for (const slot of pool.slots) {
    if (slot.mod === bucket) rows.set(slot.index, { pick: slot.beatmapId, list: [] });
  }
  if (bucket === null) return rows;
  for (const [key, list] of Object.entries(pool.candidates ?? {})) {
    const place = placeOfKey(key);
    if (place?.bucket === bucket && list.length > 0) {
      rows.set(place.index, { pick: rows.get(place.index)?.pick ?? null, list });
    }
  }
  return rows;
};

/**
 * @function withRows
 * @param pool {BuiltContent} a pool
 * @param bucket {string | null} the bucket the rows are for
 * @param rows {ReadonlyMap<number, SlotRow>} its new rows
 * @returns {BuiltContent} the pool with that bucket's picks and candidates replaced
 */
export const withRows = (
  pool: BuiltContent,
  bucket: string | null,
  rows: ReadonlyMap<number, SlotRow>,
): BuiltContent => {
  const slots: PoolSlot[] = pool.slots.filter((slot) => slot.mod !== bucket);
  const candidates: Record<string, Candidate[]> = Object.fromEntries(
    Object.entries(pool.candidates ?? {}).filter(([key]) => placeOfKey(key)?.bucket !== bucket),
  );
  for (const [index, row] of rows) {
    if (row.pick !== null) slots.push({ mod: bucket, index, beatmapId: row.pick });
    if (bucket !== null && row.list.length > 0)
      candidates[candidateKey({ bucket, index })] = row.list;
  }
  return { ...pool, slots: sortSlots(slots, bucketsOf(pool)), candidates };
};

/** Rows from `from` on moved by `by` (the others as they are). */
const shifted = (rows: Rows, from: number, by: 1 | -1): Rows =>
  new Map([...rows].map(([index, row]) => [index >= from ? index + by : index, row]));

/** The rows without slot `index`: the row itself goes, the later ones close up. */
const closedUp = (rows: Rows, index: number): Rows => {
  const rest = new Map(rows);
  rest.delete(index);
  return shifted(rest, index + 1, -1);
};

/**
 * Puts `row` at `at`. A lone pick fills a row with no pick when `fill`; anything else there moves
 * up with the later rows.
 */
const placed = (rows: Rows, at: number, row: SlotRow, fill: boolean): Rows => {
  const there = rows.get(at);
  if (fill && there && there.pick === null && row.list.length === 0) {
    return new Map(rows).set(at, { pick: row.pick, list: there.list });
  }
  const next = there ? shifted(rows, at, 1) : new Map(rows);
  if (Math.max(0, ...next.keys()) > MAX_SLOT_INDEX)
    throw new OpError("slot_full", OP_MESSAGES.slotFull);
  return next.set(at, row);
};

/** Where an added map goes: a numbered row without a pick, else at most one past the picks. */
const landing = (pool: BuiltContent, rows: Rows, bucket: string | null, index?: number) => {
  if (index !== undefined && rows.get(index)?.pick === null) return index;
  const next = nextSlotIndex(pool.slots, bucket);
  if (next > MAX_SLOT_INDEX) throw new OpError("slot_full", OP_MESSAGES.slotFull);
  return Math.min(index ?? next, next);
};

/**
 * @function insertPick
 * @param pool {BuiltContent} a pool (the bucket already checked)
 * @param bucket {string | null} where the map goes
 * @param beatmapId {number} the map
 * @param index {number | undefined} its slot number (the end when left out)
 * @returns {BuiltContent} the pool with the map as that slot's pick
 * @throws {OpError} slot_full past slot 99
 */
export const insertPick = (
  pool: BuiltContent,
  bucket: string | null,
  beatmapId: number,
  index?: number,
): BuiltContent => {
  const rows = rowsOf(pool, bucket);
  const at = landing(pool, rows, bucket, index);
  return withRows(pool, bucket, placed(rows, at, { pick: beatmapId, list: [] }, true));
};

/**
 * @function removePick
 * @param pool {BuiltContent} a pool
 * @param ref {{ bucket: string | null; index: number }} a slot with a pick
 * @returns {BuiltContent} the pool without that pick: its row stays when it has candidates, else
 *          the bucket closes up
 */
export const removePick = (
  pool: BuiltContent,
  ref: { bucket: string | null; index: number },
): BuiltContent => {
  const rows = rowsOf(pool, ref.bucket);
  const row = rows.get(ref.index);
  if (row && row.list.length > 0) {
    return withRows(pool, ref.bucket, new Map(rows).set(ref.index, { pick: null, list: row.list }));
  }
  return withRows(pool, ref.bucket, closedUp(rows, ref.index));
};

/**
 * @function moveRow
 * @param pool {BuiltContent} a pool
 * @param ref {{ bucket: string | null; index: number }} a slot with a pick
 * @param index {number | undefined} its new number in the same bucket (the last row's when left
 *        out or past it)
 * @returns {BuiltContent} the pool with the whole row (pick and candidates) at its new number and
 *          the rows between shifted one toward its old number; rows outside that range keep
 *          theirs, so moving it back undoes it exactly
 */
export const moveRow = (
  pool: BuiltContent,
  ref: { bucket: string | null; index: number },
  index?: number,
): BuiltContent => {
  const rows = rowsOf(pool, ref.bucket);
  const row = rows.get(ref.index);
  if (!row) return pool;
  const from = ref.index;
  const last = Math.max(...rows.keys());
  const to = Math.min(index ?? last, last);
  const [low, high, by] = to > from ? [from + 1, to, -1] : [to, from - 1, 1];
  const moved: Rows = new Map();
  for (const [at, other] of rows) {
    if (at === from) continue;
    moved.set(at >= low && at <= high ? at + by : at, other);
  }
  return withRows(pool, ref.bucket, moved.set(to, row));
};
