/**
 * @file src/components/builder/PoolMaps.tsx
 * @desc The editor's maps: every bucket in the pool's order (with its target's placeholders and
 *       badges), each slot with its move and remove buttons and its note. Slots can also be
 *       dragged by their handle onto another row or bucket (src/hooks/useSlotDrag.ts, a
 *       moveMap); the buttons stay the keyboard's way. Keyboard use never loses its place: after a move, focus stays on the moved map
 *       (the same button when it still applies, else the next one that does); after a remove, it
 *       goes to the next map in the bucket, or the one before, or the bucket's Find maps. Focus
 *       moves once the changed pool is on screen, not on a render in between. It's a size
 *       container, so a slot row lays out by the card's width, not the screen's.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Mon Sep 28, 2026
 */

"use client";

import { bucketOptionLabel, type PoolSlot } from "@haruhimemoe/pool";
import { useEffect, useRef } from "react";
import { BucketSection } from "@/components/builder/BucketSection";
import { useSlotDrag } from "@/hooks/useSlotDrag";
import type { PoolOp } from "@/schemas/built-pool-ops";
import type { BuiltMaps, ClientPool } from "@/schemas/built-pool-view";
import { groupSlots, moveToOp, moveWithinOp, removeOp } from "@/utils/built-editor";
import { dropOp } from "@/utils/drag-move";
import type { SlotValueMap } from "@/utils/slot-values";

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

  const onMove = (slot: PoolSlot, direction: "up" | "down") => {
    const group = groups.find((g) => g.code === slot.mod)?.slots ?? [];
    const order = direction === "up" ? ["up", "down"] : ["down", "up"];
    run(moveWithinOp(group, slot, direction), inRow(slot.beatmapId, [...order, "remove"]));
  };

  const onMoveTo = (slot: PoolSlot, bucket: string) =>
    run(moveToOp(slot, bucket), inRow(slot.beatmapId, ["target", "remove"]));

  const drag = useSlotDrag((slot, target) =>
    run(dropOp(slot, target), inRow(slot.beatmapId, ["up", "down", "remove"])),
  );

  const onRemove = (slot: PoolSlot) => {
    const group = groups.find((g) => g.code === slot.mod)?.slots ?? [];
    const at = group.indexOf(slot);
    const near = [group[at + 1], group[at - 1]].flatMap((s) => (s ? [s.beatmapId] : []));
    const find = `[data-bucket="${slot.mod ?? ""}"] [data-control="find"]`;
    run(removeOp(slot), [...near.flatMap((id) => inRow(id, ["remove"])), find]);
  };

  return (
    <div ref={box} className="@container flex flex-col gap-5">
      {groups.map((group) => (
        <BucketSection
          key={group.code ?? ""}
          group={group}
          maps={maps}
          values={values}
          targets={targets}
          plan={group.code === null ? undefined : pool.targets[group.code]}
          notes={pool.slotNotes}
          drag={drag}
          onNote={(slot, note) => change([{ type: "setNote", beatmapId: slot.beatmapId, note }])}
          onFind={onFind}
          onRemoveBucket={(code) => run({ type: "removeBucket", code }, ['[data-control="find"]'])}
          onMove={onMove}
          onMoveTo={onMoveTo}
          onRemove={onRemove}
        />
      ))}
    </div>
  );
}
