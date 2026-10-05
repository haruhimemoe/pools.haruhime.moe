/**
 * @file src/components/builder/PoolMaps.tsx
 * @desc The editor's maps: every bucket in the pool's order (with its target's placeholders and
 *       badges), each slot with its move and remove buttons and its note. Slots and candidates
 *       drag by their handle (mouse, touch or keyboard, ui's useSortable, all lists "onto": a
 *       drop on a row takes its place, on a bucket goes to its end, src/utils/sortable-ids.ts
 *       maps a move onto dropOp and candidateDropOps); Up, Down and Move go through the same
 *       hook, which keeps focus on the moved map. After a remove, focus goes to the next map in
 *       the bucket, or the one before, or the bucket's Find maps. Focus moves once the changed
 *       pool is on screen, not on a render in between. It's a size container, so a slot row lays
 *       out by the card's width, not the screen's.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Mon Oct 5, 2026
 */

"use client";

import { bucketOptionLabel, type PoolSlot } from "@haruhimemoe/pool";
import { SortableLayer, useSortable } from "@haruhimemoe/ui";
import { useEffect, useRef } from "react";
import { BucketSection } from "@/components/builder/BucketSection";
import { useCandidateActions } from "@/hooks/useCandidateActions";
import type { PoolOp } from "@/schemas/built-pool-ops";
import type { BuiltMaps, ClientPool } from "@/schemas/built-pool-view";
import { groupSlots, removeOp } from "@/utils/built-editor";
import { dropOp } from "@/utils/drag-move";
import type { SlotValueMap } from "@/utils/slot-values";
import { candidateRefusal, dragItemOf, dropTargetOf } from "@/utils/sortable-ids";

type PoolMapsProps = {
  pool: ClientPool;
  maps: BuiltMaps;
  /** Values under each slot's mods, as far as they're known. */
  values: SlotValueMap;
  change: (ops: PoolOp[]) => boolean;
  onFind: (code: string) => void;
};

const inRow = (id: number, controls: readonly string[]) =>
  controls.map((control) => `[data-map="${id}"] [data-control="${control}"]`);

/**
 * @function PoolMaps
 * @param props {PoolMapsProps} the pool, its maps and values, the change call and Find maps
 * @returns {JSX.Element} the maps card: every bucket with its rows
 */
export function PoolMaps({ pool, maps, values, change, onFind }: PoolMapsProps) {
  const box = useRef<HTMLDivElement>(null);
  /** Where focus goes once the change is on screen, and the pool it was made from. */
  const focusNext = useRef<{ then: string[]; from: ClientPool } | null>(null);
  const groups = groupSlots(pool);
  const targets = pool.buckets.map((entry) => ({
    code: entry.code,
    label: bucketOptionLabel(entry),
  }));

  useEffect(() => {
    const pending = focusNext.current;
    // Another render (map details or values arriving) can come before the change's own.
    if (!pending || pending.from === pool) return;
    focusNext.current = null;
    if (!box.current) return;
    for (const selector of pending.then) {
      const found = box.current.querySelector<HTMLElement>(selector);
      if (found && !found.hasAttribute("disabled")) {
        found.focus();
        return;
      }
    }
  });

  const run = (ops: PoolOp | null, then: string[]) => {
    if (!ops) return;
    focusNext.current = { then, from: pool };
    if (!change([ops])) focusNext.current = null;
  };

  const candidates = useCandidateActions(pool, maps, change);
  const sortable = useSortable({
    onMove: (move) => {
      const picked = dragItemOf(move.id, pool.slots);
      const target = dropTargetOf(move, pool.slots);
      if (!picked || !target) return false;
      if (candidates.drop(picked, target)) return true;
      // The pool may have moved on during the drag (a save, a poll): dragItemOf read the pick
      // from the pool as it is now, by beatmap id.
      const op = dropOp(picked, target);
      return op === null || change([op]);
    },
    canDrop: (move) => {
      const picked = dragItemOf(move.id, pool.slots);
      const target = dropTargetOf(move, pool.slots);
      if (!picked || !target) return false;
      return candidateRefusal(picked, target) ?? true;
    },
  });

  const onRemove = (slot: PoolSlot) => {
    const group = groups.find((g) => g.code === slot.mod)?.slots ?? [];
    const at = group.indexOf(slot);
    const near = [group[at + 1], group[at - 1]].flatMap((s) => (s ? [s.beatmapId] : []));
    const find = `[data-bucket="${slot.mod ?? ""}"] [data-control="find"]`;
    run(removeOp(slot), [...near.flatMap((id) => inRow(id, ["remove"])), find]);
  };

  return (
    <div ref={box} className="@container flex flex-col gap-5">
      <SortableLayer sortable={sortable} />
      {groups.map((group) => (
        <BucketSection
          key={group.code ?? ""}
          group={group}
          maps={maps}
          values={values}
          targets={targets}
          plan={group.code === null ? undefined : pool.targets[group.code]}
          notes={pool.slotNotes}
          sortable={sortable}
          candidates={candidates.context}
          onNote={(slot, note) => change([{ type: "setNote", beatmapId: slot.beatmapId, note }])}
          onFind={onFind}
          onRemoveBucket={(code) => run({ type: "removeBucket", code }, ['[data-control="find"]'])}
          onRemove={onRemove}
        />
      ))}
    </div>
  );
}
