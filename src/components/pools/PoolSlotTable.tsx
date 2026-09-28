/**
 * @file src/components/pools/PoolSlotTable.tsx
 * @desc A pool's maps as the source listed them: slot label, the map (linking its page), its
 *       stars (with the mods they're under, or "no mod", and "no mod data" when the mirror had
 *       none), AR, OD, length and BPM under the slot's mods, and a Copy ID button for !mp map.
 *       Scrolls sideways on phones.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Mon Sep 28, 2026
 */

import { formatBpm, formatDuration, formatStat } from "@haruhimemoe/osu/format";
import { CopyButton } from "@haruhimemoe/ui";
import Link from "next/link";
import type { SourceSlotRecord } from "@/schemas/pool";
import type { MapSummary } from "@/services/pools";
import { mapLabel } from "@/utils/map-record";
import { starsText } from "@/utils/pool-text";
import { noModOf, type SlotValueAnswer, slotAnswer } from "@/utils/slot-values";

const HEADS = ["Stars", "AR", "OD", "Length", "BPM"];
const CELL = "py-2 pr-3 tabular-nums";
const orDash = (value: number | null, format: (n: number) => string) =>
  value === null ? "–" : format(value);

/** The stars cell: the rating, what it's under, and "no mod data" when the mirror had none. */
const Stars = ({ values }: { values: SlotValueAnswer }) => (
  <>
    {starsText(values.stars)}
    <span className="ml-1 text-c3 text-xs">
      {values.source === "mirror" ? values.mods : "no mod"}
    </span>
    {values.source === "math" ? <span className="block text-c3 text-xs">no mod data</span> : null}
  </>
);

export function PoolSlotTable({
  slots,
  maps,
  values,
}: {
  slots: readonly SourceSlotRecord[];
  maps: ReadonlyMap<number, MapSummary>;
  /** Each source slot's values under its mods, in order. */
  values: readonly SlotValueAnswer[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">The pool's maps, with values under each slot's mods</caption>
        <thead className="text-c3 text-xs uppercase">
          <tr>
            <th scope="col" className="py-2 pr-3">
              Slot
            </th>
            <th scope="col" className="py-2 pr-3">
              Map
            </th>
            {HEADS.map((head) => (
              <th key={head} scope="col" className="py-2 pr-3">
                {head}
              </th>
            ))}
            <th scope="col" className="py-2">
              <span className="sr-only">Copy ID</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {slots.map((slot, i) => {
            const map = maps.get(slot.beatmapId);
            const shown = values[i] ?? slotAnswer(noModOf(map), []);
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
                <td className={CELL}>
                  <Stars values={shown} />
                </td>
                <td className={CELL}>{orDash(shown.ar, formatStat)}</td>
                <td className={CELL}>{orDash(shown.od, formatStat)}</td>
                <td className={CELL}>{orDash(shown.length, formatDuration)}</td>
                <td className={CELL}>{orDash(shown.bpm, formatBpm)}</td>
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
