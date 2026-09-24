/**
 * @file src/components/pools/PoolSlotTable.tsx
 * @desc A pool's maps as the source listed them: slot label, the map (linking its page), no-mod
 *       stars, length, BPM, and a Copy ID button for !mp map. Scrolls sideways on phones.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { CopyButton } from "@haruhimemoe/ui";
import Link from "next/link";
import type { SourceSlotRecord } from "@/schemas/pool";
import type { MapSummary } from "@/services/pools";
import { formatBpm, formatDuration } from "@/utils/format";
import { mapLabel } from "@/utils/map-record";
import { starsText } from "@/utils/pool-text";

export function PoolSlotTable({
  slots,
  maps,
}: {
  slots: readonly SourceSlotRecord[];
  maps: ReadonlyMap<number, MapSummary>;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">The pool's maps, with star ratings without mods</caption>
        <thead className="text-c3 text-xs uppercase">
          <tr>
            <th scope="col" className="py-2 pr-3">
              Slot
            </th>
            <th scope="col" className="py-2 pr-3">
              Map
            </th>
            <th scope="col" className="py-2 pr-3">
              Stars (no mod)
            </th>
            <th scope="col" className="py-2 pr-3">
              Length
            </th>
            <th scope="col" className="py-2 pr-3">
              BPM
            </th>
            <th scope="col" className="py-2">
              <span className="sr-only">Copy ID</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {slots.map((slot, i) => {
            const map = maps.get(slot.beatmapId);
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: a source can list the same label and map twice; the rows never reorder
              <tr key={`${slot.label}-${slot.beatmapId}-${i}`} className="border-b4 border-t">
                <th scope="row" className="py-2 pr-3 font-bold text-c1">
                  {slot.label}
                </th>
                <td className="py-2 pr-3">
                  <Link href={`/maps/${slot.beatmapId}`} className="hover:text-c1 hover:underline">
                    {mapLabel(map, slot.beatmapId)}
                  </Link>
                </td>
                <td className="py-2 pr-3 tabular-nums">{starsText(map?.stars ?? null)}</td>
                <td className="py-2 pr-3 tabular-nums">
                  {map?.length == null ? "–" : formatDuration(map.length)}
                </td>
                <td className="py-2 pr-3 tabular-nums">
                  {map?.bpm == null ? "–" : formatBpm(map.bpm)}
                </td>
                <td className="py-2">
                  <CopyButton
                    text={String(slot.beatmapId)}
                    label="Copy ID"
                    aria-label={`Copy beatmap ID ${slot.beatmapId}`}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
