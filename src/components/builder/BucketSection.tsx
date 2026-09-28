/**
 * @file src/components/builder/BucketSection.tsx
 * @desc One bucket in the editor: its code and what it plays with, "Find maps" (opens the map
 *       browser for it), "Remove slot" for an empty custom bucket, and its maps in order. Maps
 *       with no slot get a group of their own, with no Find maps. Each map shows its values
 *       under the bucket's mods once known. Presentational.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

"use client";

import { isCustomBucket, type PoolSlot } from "@haruhimemoe/pool";
import { Button } from "@haruhimemoe/ui";
import { useId } from "react";
import { type MoveTarget, SlotRow } from "@/components/builder/SlotRow";
import type { BuiltMaps } from "@/schemas/built-pool-view";
import { groupHeading, type SlotGroup } from "@/utils/built-editor";
import { groupSlotCode, type SlotValueMap, slotValueKey } from "@/utils/slot-values";

export type SlotActions = {
  onMove: (slot: PoolSlot, direction: "up" | "down") => void;
  onMoveTo: (slot: PoolSlot, bucket: string) => void;
  onRemove: (slot: PoolSlot) => void;
};

type BucketSectionProps = SlotActions & {
  group: SlotGroup;
  maps: BuiltMaps;
  /** Values under each slot's mods, as far as they're known. */
  values: SlotValueMap;
  /** Every bucket a map can move to. */
  targets: readonly MoveTarget[];
  onFind: (code: string) => void;
  onRemoveBucket: (code: string) => void;
};

export function BucketSection({ group, maps, values, targets, ...on }: BucketSectionProps) {
  const headingId = useId();
  const { title, detail } = groupHeading(group.entry);
  const { code, entry, slots } = group;
  const others = targets.filter((target) => target.code !== code);
  return (
    <section aria-labelledby={headingId} data-bucket={code ?? ""} className="flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={headingId} tabIndex={-1} className="font-bold text-c1">
          {title}
          {detail ? <span className="font-normal text-c3 text-sm"> {detail}</span> : null}
        </h3>
        {code !== null ? (
          <div className="flex gap-2">
            {entry && isCustomBucket(entry) && slots.length === 0 ? (
              <Button
                variant="ghost"
                aria-label={`Remove slot ${code}`}
                onClick={() => on.onRemoveBucket(code)}
              >
                Remove slot
              </Button>
            ) : null}
            <Button
              variant="secondary"
              data-control="find"
              aria-label={`Find maps for ${code}`}
              onClick={() => on.onFind(code)}
            >
              Find maps
            </Button>
          </div>
        ) : null}
      </div>
      {slots.length === 0 ? (
        <p className="py-2 text-c3 text-sm">No maps yet.</p>
      ) : (
        <ol className="flex flex-col">
          {slots.map((slot, i) => (
            <SlotRow
              key={slot.beatmapId}
              slot={slot}
              map={maps[slot.beatmapId]}
              values={values[slotValueKey(slot.beatmapId, groupSlotCode(slot, entry))]}
              first={i === 0}
              last={i === slots.length - 1}
              targets={others}
              onMove={(direction) => on.onMove(slot, direction)}
              onMoveTo={(bucket) => on.onMoveTo(slot, bucket)}
              onRemove={() => on.onRemove(slot)}
            />
          ))}
        </ol>
      )}
    </section>
  );
}
