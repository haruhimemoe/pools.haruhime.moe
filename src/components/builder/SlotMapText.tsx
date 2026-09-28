/**
 * @file src/components/builder/SlotMapText.tsx
 * @desc One slot's map as the builder and built pool pages show it: "Artist - Title [Version]"
 *       (optionally linking the difficulty on osu!), then its mapper, its values under the
 *       slot's mods (stars with the combo, AR, OD, length, BPM, and "no mod data" when the mirror
 *       had none) and beatmap ID. Until those values are known it shows the no-mod stars, length
 *       and BPM. "Beatmap <id>" until its details are known. Presentational.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

import { beatmapUrl } from "@haruhimemoe/osu/shapes";
import type { BuiltMap } from "@/schemas/built-pool-view";
import { formatBpm, formatDuration } from "@/utils/format";
import { mapLabel } from "@/utils/map-record";
import { starsText } from "@/utils/pool-text";
import { type SlotValueAnswer, slotValuesText } from "@/utils/slot-values";

type SlotMapTextProps = {
  beatmapId: number;
  map: BuiltMap | null | undefined;
  /** Its values under the slot's mods, once known. */
  values?: SlotValueAnswer | undefined;
  /** Link the map to its page on osu!. */
  link?: boolean;
};

const noModFacts = (map: BuiltMap | null | undefined): (string | null)[] => [
  `${starsText(map?.stars ?? null)} no mod`,
  map?.length == null ? null : formatDuration(map.length),
  map?.bpm == null ? null : `${formatBpm(map.bpm)} BPM`,
];

const valueFacts = (values: SlotValueAnswer): string[] => {
  const { stars, facts, note } = slotValuesText(values);
  return note ? [stars, ...facts, note] : [stars, ...facts];
};

export function SlotMapText({ beatmapId, map, values, link = false }: SlotMapTextProps) {
  const label = mapLabel(map, beatmapId);
  const facts = [
    map?.setHost ? `mapped by ${map.setHost}` : null,
    ...(values ? valueFacts(values) : noModFacts(map)),
    `ID ${beatmapId}`,
  ].filter((part): part is string => part !== null);
  return (
    <div className="min-w-0 break-words">
      {link ? (
        <a
          href={beatmapUrl(beatmapId)}
          rel="noreferrer"
          className="font-bold text-c1 hover:underline"
        >
          {label}
        </a>
      ) : (
        <p className="font-bold text-c1">{label}</p>
      )}
      <p className="text-c3 text-xs">{facts.join(" · ")}</p>
    </div>
  );
}
