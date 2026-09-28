/**
 * @file src/components/builder/BuiltSlotList.tsx
 * @desc A built pool's maps on its page: each bucket that has maps, in the pool's order, with its
 *       slots (label, the map linking osu!, its mapper and no-mod values). Read only.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

import { type BucketEntry, type PoolSlot, slotLabel } from "@haruhimemoe/pool";
import { SlotMapText } from "@/components/builder/SlotMapText";
import type { BuiltMaps } from "@/schemas/built-pool-view";
import { groupHeading, groupSlots } from "@/utils/built-editor";

type BuiltSlotListProps = {
  pool: { buckets: readonly BucketEntry[]; slots: readonly PoolSlot[] };
  maps: BuiltMaps;
};

export function BuiltSlotList({ pool, maps }: BuiltSlotListProps) {
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
                  <span className="w-14 shrink-0 font-bold text-c1">{slotLabel(slot)}</span>
                  <SlotMapText beatmapId={slot.beatmapId} map={maps[slot.beatmapId]} link />
                </li>
              ))}
            </ol>
          </section>
        );
      })}
    </div>
  );
}
