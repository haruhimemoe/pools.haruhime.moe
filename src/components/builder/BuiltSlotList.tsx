/**
 * @file src/components/builder/BuiltSlotList.tsx
 * @desc A built pool's maps on its page: each bucket that has maps, in the pool's order, with its
 *       slots (label, its cover and preview clip, the map linking osu!, its mapper, its values
 *       under the slot's mods and its note) as the shared MapCard, with a Copy ID button per map.
 *       Read only.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Mon Oct 5, 2026
 */

import { type BucketEntry, type PoolSlot, slotLabel } from "@haruhimemoe/pool";
import { MapCard, MapGroup, MapPreviewButton, Text } from "@haruhimemoe/ui";
import type { SlotNotes } from "@/schemas/built-plan";
import type { BuiltMaps } from "@/schemas/built-pool-view";
import { groupHeading, groupSlots } from "@/utils/built-editor";
import { slotFacts, toMapData } from "@/utils/map-card";
import { songOf } from "@/utils/map-preview";
import { groupSlotCode, type SlotValueMap, slotValueKey } from "@/utils/slot-values";

type BuiltSlotListProps = {
  pool: { buckets: readonly BucketEntry[]; slots: readonly PoolSlot[]; slotNotes?: SlotNotes };
  maps: BuiltMaps;
  /** Values under each slot's mods. */
  values: SlotValueMap;
};

/**
 * @function BuiltSlotList
 * @param props {BuiltSlotListProps} the pool, its maps and values
 * @returns {JSX.Element} the pool's slots by bucket with each map's values and note
 */
export function BuiltSlotList({ pool, maps, values }: BuiltSlotListProps) {
  const groups = groupSlots(pool).filter((group) => group.slots.length > 0);
  if (groups.length === 0) return <Text tone="muted">No maps yet.</Text>;
  return (
    <div className="flex flex-col gap-5">
      {groups.map((group) => {
        const { title, detail } = groupHeading(group.entry);
        return (
          <MapGroup key={group.code ?? ""} title={title} detail={detail} copyScope>
            {group.slots.map((slot) => {
              const map = maps[slot.beatmapId];
              const facts = slotFacts(
                values[slotValueKey(slot.beatmapId, groupSlotCode(slot, group.entry))],
                map,
              );
              const note = pool.slotNotes?.[String(slot.beatmapId)];
              return (
                <MapCard
                  key={slot.beatmapId}
                  as="li"
                  className="rounded-none border-b3 border-t bg-transparent px-0 py-3"
                  beatmapId={slot.beatmapId}
                  map={toMapData(map)}
                  slot={{ label: slotLabel(slot) }}
                  preview={
                    map?.setId ? (
                      <MapPreviewButton
                        beatmapsetId={map.setId}
                        song={songOf(map, slot.beatmapId)}
                      />
                    ) : undefined
                  }
                  stars={facts.stars}
                  starsNote={facts.starsNote}
                  stats={facts.stats}
                  details={
                    facts.note || note ? (
                      <>
                        {facts.note ? (
                          <Text as="span" size="xs" tone="muted">
                            {facts.note}
                          </Text>
                        ) : null}
                        {note ? (
                          <Text tone="default" className="mt-1 break-words">
                            {note}
                          </Text>
                        ) : null}
                      </>
                    ) : undefined
                  }
                  copyId
                />
              );
            })}
          </MapGroup>
        );
      })}
    </div>
  );
}
