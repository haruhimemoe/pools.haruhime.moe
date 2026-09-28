/**
 * @file src/components/builder/PoolMaps.tsx
 * @desc The editor's maps: every bucket in the pool's order, each slot with its move and remove
 *       buttons. Keyboard use never loses its place: after a move, focus stays on the moved map
 *       (the same button when it still applies, else the next one that does); after a remove, it
 *       goes to the next map in the bucket, or the one before, or the bucket's Find maps.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

"use client";

import { bucketOptionLabel, type PoolSlot } from "@haruhimemoe/pool";
import { useEffect, useRef } from "react";
import { BucketSection } from "@/components/builder/BucketSection";
import type { PoolOp } from "@/schemas/built-pool-ops";
import type { BuiltMaps, ClientPool } from "@/schemas/built-pool-view";
import { groupSlots, moveToOp, moveWithinOp, removeOp } from "@/utils/built-editor";

type PoolMapsProps = {
  pool: ClientPool;
  maps: BuiltMaps;
  change: (ops: PoolOp[]) => boolean;
  onFind: (code: string) => void;
};

const inRow = (id: number, controls: readonly string[]) =>
  controls.map((control) => `[data-map="${id}"] [data-control="${control}"]`);

export function PoolMaps({ pool, maps, change, onFind }: PoolMapsProps) {
  const box = useRef<HTMLDivElement>(null);
  const focusNext = useRef<string[] | null>(null);
  const groups = groupSlots(pool);
  const targets = pool.buckets.map((entry) => ({
    code: entry.code,
    label: bucketOptionLabel(entry),
  }));

  useEffect(() => {
    const selectors = focusNext.current;
    focusNext.current = null;
    if (!selectors || !box.current) return;
    for (const selector of selectors) {
      const found = box.current.querySelector<HTMLElement>(selector);
      if (found && !found.hasAttribute("disabled")) {
        found.focus();
        return;
      }
    }
  });

  const run = (ops: PoolOp | null, then: string[]) => {
    if (!ops) return;
    focusNext.current = then;
    if (!change([ops])) focusNext.current = null;
  };

  const onMove = (slot: PoolSlot, direction: "up" | "down") => {
    const group = groups.find((g) => g.code === slot.mod)?.slots ?? [];
    const order = direction === "up" ? ["up", "down"] : ["down", "up"];
    run(moveWithinOp(group, slot, direction), inRow(slot.beatmapId, [...order, "remove"]));
  };

  const onMoveTo = (slot: PoolSlot, bucket: string) =>
    run(moveToOp(slot, bucket), inRow(slot.beatmapId, ["target", "remove"]));

  const onRemove = (slot: PoolSlot) => {
    const group = groups.find((g) => g.code === slot.mod)?.slots ?? [];
    const at = group.indexOf(slot);
    const near = [group[at + 1], group[at - 1]].flatMap((s) => (s ? [s.beatmapId] : []));
    const find = `[data-bucket="${slot.mod ?? ""}"] [data-control="find"]`;
    run(removeOp(slot), [...near.flatMap((id) => inRow(id, ["remove"])), find]);
  };

  return (
    <div ref={box} className="flex flex-col gap-5">
      {groups.map((group) => (
        <BucketSection
          key={group.code ?? ""}
          group={group}
          maps={maps}
          targets={targets}
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
