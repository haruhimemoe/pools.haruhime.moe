/**
 * @file src/components/search/MapResultList.tsx
 * @desc Map results: each map's label (its page), set host, usage line, no-mod stars, length,
 *       BPM, and what it was played as.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Mon Sep 28, 2026
 */

import { formatBpm, formatDuration } from "@haruhimemoe/osu/format";
import { TextLink } from "@haruhimemoe/ui";
import type { MapResult } from "@/schemas/search-response";
import { mapLabel } from "@/utils/map-record";
import { starsText } from "@/utils/pool-text";
import { usageSummary } from "@/utils/usage";

export function MapResultList({ results }: { results: readonly MapResult[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {results.map((map) => (
        <li key={map.id} className="rounded-lg bg-b4 p-4">
          <TextLink href={`/maps/${map.id}`} variant="plain">
            {mapLabel(map, map.id)}
          </TextLink>
          <p className="text-c3 text-sm">
            {[
              map.setHost ? `Set host ${map.setHost}` : null,
              usageSummary(map.usage),
              `${starsText(map.stars)} (no mod)`,
              map.length === null ? null : formatDuration(map.length),
              map.bpm === null ? null : `${formatBpm(map.bpm)} BPM`,
              map.usage.playedAs.length > 0 ? `played as ${map.usage.playedAs.join(", ")}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </li>
      ))}
    </ul>
  );
}
