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
import { CopyButton, Table, TBody, Td, THead, Th } from "@haruhimemoe/ui";
import Link from "next/link";
import type { SourceSlotRecord } from "@/schemas/pool";
import type { MapSummary } from "@/services/pools";
import { mapLabel } from "@/utils/map-record";
import { starsText } from "@/utils/pool-text";
import { noModOf, type SlotValueAnswer, slotAnswer } from "@/utils/slot-values";

const HEADS = ["Stars", "AR", "OD", "Length", "BPM"];
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
    <Table caption="The pool's maps, with values under each slot's mods" hideCaption>
      <THead>
        <tr>
          <Th>Slot</Th>
          <Th>Map</Th>
          {HEADS.map((head) => (
            <Th key={head}>{head}</Th>
          ))}
          <Th>
            <span className="sr-only">Copy ID</span>
          </Th>
        </tr>
      </THead>
      <TBody>
        {slots.map((slot, i) => {
          const map = maps.get(slot.beatmapId);
          const shown = values[i] ?? slotAnswer(noModOf(map), []);
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: a source can list the same label and map twice; the rows never reorder
            <tr key={`${slot.label}-${slot.beatmapId}-${i}`}>
              <Th scope="row">{slot.label}</Th>
              <Td>
                <Link href={`/maps/${slot.beatmapId}`} className="hover:text-c1 hover:underline">
                  {mapLabel(map, slot.beatmapId)}
                </Link>
              </Td>
              <Td>
                <Stars values={shown} />
              </Td>
              <Td numeric>{orDash(shown.ar, formatStat)}</Td>
              <Td numeric>{orDash(shown.od, formatStat)}</Td>
              <Td numeric>{orDash(shown.length, formatDuration)}</Td>
              <Td numeric>{orDash(shown.bpm, formatBpm)}</Td>
              <Td>
                <CopyButton
                  text={String(slot.beatmapId)}
                  label="Copy ID"
                  aria-label={`Copy beatmap ID ${slot.beatmapId}`}
                />
              </Td>
            </tr>
          );
        })}
      </TBody>
    </Table>
  );
}
