/**
 * @file src/components/search/MapResultList.tsx
 * @desc Map results: each map's label (its page), set host, usage line, no-mod stars, length,
 *       BPM, and what it was played as. Each map is @haruhimemoe/ui's shared MapCard, compact,
 *       with no cover (a MapResult has no set id).
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Mon Oct 5, 2026
 */

import { MapCard, Text } from "@haruhimemoe/ui";
import type { MapResult } from "@/schemas/search-response";
import { usageSummary } from "@/utils/usage";

/**
 * @function MapResultList
 * @param props {{ results: readonly MapResult[] }} one page of played maps
 * @returns {JSX.Element} each map with its usage and values
 */
export function MapResultList({ results }: { results: readonly MapResult[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {results.map((map) => (
        <MapCard
          key={map.id}
          as="li"
          density="compact"
          beatmapId={map.id}
          map={{
            artist: map.artist,
            title: map.title,
            version: map.version,
            creator: map.setHost,
            starRating: map.stars,
            bpm: map.bpm,
            lengthSeconds: map.length,
          }}
          href={`/maps/${map.id}`}
          coverUrl={null}
          starsNote="no mod"
          labels={{ mappedBy: (host) => `set host ${host}` }}
          details={
            <Text size="xs" tone="muted">
              {[
                usageSummary(map.usage),
                map.usage.playedAs.length > 0 ? `played as ${map.usage.playedAs.join(", ")}` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </Text>
          }
        />
      ))}
    </ul>
  );
}
