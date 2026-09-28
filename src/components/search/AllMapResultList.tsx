/**
 * @file src/components/search/AllMapResultList.tsx
 * @desc All-maps results: one card per beatmapset (artist, title, mapper, the status as osu!
 *       names it: Ranked, Approved, Loved, Qualified, Pending, WIP or Graveyard; an Unranked tag
 *       for graveyard, pending and WIP sets, and "Check first" with the reason for sets that
 *       need a closer look), each osu!standard difficulty with its no-mod stars, length and BPM
 *       and how many pools played it (a link to its map page when some did), and a link to the
 *       set on osu!.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sat Sep 26, 2026
 * @modified Mon Sep 28, 2026
 */

import { formatBpm, formatDuration } from "@haruhimemoe/osu/format";
import { Badge, TextLink } from "@haruhimemoe/ui";
import { StarsUnder } from "@/components/maps/StarsUnder";
import { SET_STATUS_LABELS } from "@/constants/search";
import type { AllMapDifficulty, AllMapSet } from "@/schemas/search-response";

const playedText = (map: AllMapDifficulty) => {
  if (map.playedIn === null) return <span>Pool history unavailable</span>;
  if (map.playedIn === 0) return <span>Not played in a pool yet</span>;
  return (
    <TextLink href={`/maps/${map.id}`}>
      Played in {map.playedIn} {map.playedIn === 1 ? "pool" : "pools"}
    </TextLink>
  );
};

/**
 * @function AllMapResultList
 * @param props {{ results: readonly AllMapSet[] }} one page of sets
 * @returns {JSX.Element} each set with its tags and difficulties
 */
export function AllMapResultList({ results }: { results: readonly AllMapSet[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {results.map((set) => (
        <li key={set.setId} className="rounded-lg bg-b4 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <TextLink
              href={`https://osu.ppy.sh/beatmapsets/${set.setId}`}
              rel="noreferrer"
              variant="plain"
            >
              {`${set.artist} - ${set.title}`}
            </TextLink>
            <Badge>{SET_STATUS_LABELS[set.status] ?? set.status}</Badge>
            {set.unranked ? <Badge tone="warning">Unranked</Badge> : null}
            {set.check ? <Badge tone="warning">Check first</Badge> : null}
          </div>
          <p className="text-c3 text-sm">Mapped by {set.creator}</p>
          {set.check ? <p className="text-amber-200 text-sm">{set.check.text}</p> : null}
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {set.maps.map((map) => (
              <li key={map.id} className="flex flex-wrap gap-x-2 text-c2">
                <span className="font-bold">{map.version}</span>
                <StarsUnder stars={map.stars} under="(no mod)" />
                <span>{`${formatDuration(map.length)} · ${formatBpm(map.bpm)} BPM`}</span>
                <span className="text-c3">·</span>
                {playedText(map)}
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}
