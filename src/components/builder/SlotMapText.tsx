/**
 * @file src/components/builder/SlotMapText.tsx
 * @desc One slot's map as the builder and built pool pages show it: "Artist - Title [Version]"
 *       (optionally linking the difficulty on osu!), then its mapper, no-mod stars and beatmap
 *       ID. "Beatmap <id>" until its details are known. Presentational.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

import { beatmapUrl } from "@haruhimemoe/osu/shapes";
import type { BuiltMap } from "@/schemas/built-pool-view";
import { formatBpm, formatDuration } from "@/utils/format";
import { mapLabel } from "@/utils/map-record";
import { starsText } from "@/utils/pool-text";

type SlotMapTextProps = {
  beatmapId: number;
  map: BuiltMap | null | undefined;
  /** Link the map to its page on osu!. */
  link?: boolean;
};

export function SlotMapText({ beatmapId, map, link = false }: SlotMapTextProps) {
  const label = mapLabel(map, beatmapId);
  const facts = [
    map?.setHost ? `mapped by ${map.setHost}` : null,
    `${starsText(map?.stars ?? null)} no mod`,
    map?.length == null ? null : formatDuration(map.length),
    map?.bpm == null ? null : `${formatBpm(map.bpm)} BPM`,
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
