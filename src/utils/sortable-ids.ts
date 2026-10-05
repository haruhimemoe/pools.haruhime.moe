/**
 * @file src/utils/sortable-ids.ts
 * @desc The editor's sortable ids and what they mean. Lists: `b:<code>` per bucket ("" for maps
 *       with no slot) and `c:<code>:<number>` per slot's candidate list. Rows: `pick:<beatmap>`,
 *       `cand:<code>:<number>:<beatmap>`, and `empty:<code>:<number>` (a slot with candidates and
 *       no pick, a drop target only). dragItemOf and dropTargetOf turn ui's SortableMove back
 *       into the DragItem and DropTarget that dropOp and candidateDropOps already take, reading a
 *       pick from the current pool (it may have changed mid-drag). Read from the right, so a
 *       bucket code may hold ":". Pure, and safe in the browser.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Oct 4, 2026
 * @modified Mon Oct 5, 2026
 */

import type { PoolSlot } from "@haruhimemoe/pool";
import type { SortableMove } from "@haruhimemoe/ui";
import { CANDIDATE_DRAG_TEXT } from "@/constants/candidates";
import type { SlotPlace } from "@/schemas/built-candidates";
import type { DragItem, DropTarget } from "@/utils/drag-move";

/**
 * @function bucketListId
 * @param code {string | null} a bucket, null for maps with no slot
 * @returns {string} its list's id
 */
export const bucketListId = (code: string | null): string => `b:${code ?? ""}`;

/**
 * @function candidateListId
 * @param place {SlotPlace} a slot
 * @returns {string} its candidate list's id
 */
export const candidateListId = (place: SlotPlace): string => `c:${place.bucket}:${place.index}`;

/**
 * @function pickId
 * @param beatmapId {number} a pick's map
 * @returns {string} its row's id
 */
export const pickId = (beatmapId: number): string => `pick:${beatmapId}`;

/**
 * @function candidateId
 * @param place {SlotPlace} its slot
 * @param beatmapId {number} the candidate's map
 * @returns {string} its row's id
 */
export const candidateId = (place: SlotPlace, beatmapId: number): string =>
  `cand:${place.bucket}:${place.index}:${beatmapId}`;

/**
 * @function emptySlotId
 * @param place {SlotPlace} a slot with candidates and no pick
 * @returns {string} its row's id
 */
export const emptySlotId = (place: SlotPlace): string => `empty:${place.bucket}:${place.index}`;

const after = (id: string, prefix: string): string | null =>
  id.startsWith(prefix) ? id.slice(prefix.length) : null;

/** "NM:2" or "A:B:2:456": the code (which may hold ":") and the trailing whole numbers. */
const tail = (rest: string, count: number): { bucket: string; values: number[] } | null => {
  const parts = rest.split(":");
  if (parts.length < count + 1) return null;
  const values = parts.slice(-count).map(Number);
  if (!values.every(Number.isInteger)) return null;
  return { bucket: parts.slice(0, -count).join(":"), values };
};

/**
 * @function dragItemOf
 * @param id {string} a dragged row's id
 * @param slots {readonly PoolSlot[]} the pool's slots now
 * @returns {DragItem | null} the pick as it is now, or the candidate, or null
 */
export const dragItemOf = (id: string, slots: readonly PoolSlot[]): DragItem | null => {
  const pick = after(id, "pick:");
  if (pick !== null) return slots.find((slot) => slot.beatmapId === Number(pick)) ?? null;
  const rest = after(id, "cand:");
  const parts = rest === null ? null : tail(rest, 2);
  if (!parts) return null;
  const [index = 0, beatmapId = 0] = parts.values;
  return { mod: parts.bucket, index, beatmapId, candidate: true };
};

/**
 * @function dropTargetOf
 * @param move {Pick<SortableMove, "to" | "onto">} where ui says it was dropped
 * @param slots {readonly PoolSlot[]} the pool's slots now
 * @returns {DropTarget | null} a candidate list (whatever it was dropped on in it), a pick or
 *          empty row (that slot), the bucket's own space (index null), or null
 */
export const dropTargetOf = (
  move: Pick<SortableMove, "to" | "onto">,
  slots: readonly PoolSlot[],
): DropTarget | null => {
  const list = after(move.to.container, "c:");
  if (list !== null) {
    const parts = tail(list, 1);
    return parts ? { bucket: parts.bucket, index: parts.values[0] ?? 0, zone: "candidates" } : null;
  }
  const bucket = after(move.to.container, "b:");
  if (bucket === null) return null;
  if (move.onto === null) return { bucket: bucket === "" ? null : bucket, index: null };
  const pick = after(move.onto, "pick:");
  if (pick !== null) {
    const slot = slots.find((s) => s.beatmapId === Number(pick));
    return slot ? { bucket: slot.mod, index: slot.index } : null;
  }
  const empty = after(move.onto, "empty:");
  const parts = empty === null ? null : tail(empty, 1);
  return parts ? { bucket: parts.bucket, index: parts.values[0] ?? 0 } : null;
};

/**
 * @function candidateRefusal
 * @param item {DragItem} what is dragged
 * @param target {DropTarget} where it would drop
 * @returns {string | null} why a candidate can't go there (another bucket, or a bucket's own
 *          space: candidates are judged under their bucket's mods and belong to a slot), else null
 */
export const candidateRefusal = (item: DragItem, target: DropTarget): string | null => {
  if (!item.candidate) return null;
  if (target.bucket !== item.mod) return CANDIDATE_DRAG_TEXT.otherBucket;
  if (target.index === null) return CANDIDATE_DRAG_TEXT.noSlot;
  return null;
};
