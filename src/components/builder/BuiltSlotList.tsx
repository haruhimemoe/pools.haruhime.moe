/**
 * @file src/components/builder/BuiltSlotList.tsx
 * @desc A built pool's maps on its page: each bucket that has maps, in the pool's order, with its
 *       slots (label, its cover and preview clip, the map linking osu!, its mapper, its values under the slot's mods and its note).
 *       Read only.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Mon Sep 28, 2026
 */

import { type BucketEntry, type PoolSlot, slotLabel } from "@haruhimemoe/pool";
import { ModBadge } from "@haruhimemoe/ui";
import { MapPreview } from "@/components/builder/MapPreview";
import { SlotMapText } from "@/components/builder/SlotMapText";
import type { SlotNotes } from "@/schemas/built-plan";
import type { BuiltMaps } from "@/schemas/built-pool-view";
import { groupHeading, groupSlots } from "@/utils/built-editor";
import { songOf } from "@/utils/map-preview";
import { groupSlotCode, type SlotValueMap, slotValueKey } from "@/utils/slot-values";

type BuiltSlotListProps = {
  pool: { buckets: readonly BucketEntry[]; slots: readonly PoolSlot[]; slotNotes?: SlotNotes };
  maps: BuiltMaps;
  /** Values under each slot's mods. */
  values: SlotValueMap;
};

export function BuiltSlotList({ pool, maps, values }: BuiltSlotListProps) {
  const groups = groupSlots(pool).filter((group) => group.slots.length > 0);
  if (groups.length === 0) return <p className="text-c3 text-sm">No maps yet.</p>;
  return (
    <div className="flex flex-col gap-5">
      {groups.map((group) => {
        const { title, detail } = groupHeading(group.entry);
        return (
          <section key={group.code ?? ""} className="flex flex-col">
            <h3 className="font-bold text-c1">
              {title}
              {detail ? <span className="font-normal text-c3 text-sm"> {detail}</span> : null}
            </h3>
            <ol className="flex flex-col">
              {group.slots.map((slot) => (
                <li key={slot.beatmapId} className="flex gap-3 border-b3 border-t py-3">
                  <span className="w-14 shrink-0">
                    <ModBadge mod={slotLabel(slot)} />
                  </span>
                  <MapPreview
                    setId={maps[slot.beatmapId]?.setId ?? null}
                    song={songOf(maps[slot.beatmapId], slot.beatmapId)}
                  />
                  <div className="min-w-0">
                    <SlotMapText
                      beatmapId={slot.beatmapId}
                      map={maps[slot.beatmapId]}
                      values={
                        values[slotValueKey(slot.beatmapId, groupSlotCode(slot, group.entry))]
                      }
                      link
                    />
                    {pool.slotNotes?.[String(slot.beatmapId)] ? (
                      <p className="mt-1 break-words text-c2 text-sm">
                        {pool.slotNotes[String(slot.beatmapId)]}
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        );
      })}
    </div>
  );
}
