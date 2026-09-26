/**
 * @file src/components/search/AllMapResultList.tsx
 * @desc All-maps results: one card per beatmapset (artist, title, mapper, status, an Unranked tag
 *       for graveyard, pending and WIP sets, and "Check first" with the reason for sets that
 *       need a closer look), each osu!standard difficulty with its no-mod stars, length and BPM
 *       and how many pools played it (a link to its map page when some did), and a link to the
 *       set on osu!.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sat Sep 26, 2026
 * @modified Sat Sep 26, 2026
 */

import Link from "next/link";
import { formatBpm, formatDuration } from "@/utils/format";
import { starsText } from "@/utils/pool-text";
import type { AllMapDifficulty, AllMapSet } from "@/utils/search-params";

const Tag = ({ children, tone }: { children: string; tone: "warn" | "plain" }) => (
  <span
    className={
      tone === "warn"
        ? "rounded-full bg-amber-300/20 px-2 py-0.5 font-bold text-amber-200 text-xs"
        : "rounded-full bg-b3 px-2 py-0.5 text-c2 text-xs"
    }
  >
    {children}
  </span>
);

const playedText = (map: AllMapDifficulty) => {
  if (map.playedIn === null) return <span>Pool history unavailable</span>;
  if (map.playedIn === 0) return <span>Not played in a pool yet</span>;
  return (
    <Link href={`/maps/${map.id}`} className="text-h1 hover:underline">
      Played in {map.playedIn} {map.playedIn === 1 ? "pool" : "pools"}
    </Link>
  );
};

export function AllMapResultList({ results }: { results: readonly AllMapSet[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {results.map((set) => (
        <li key={set.setId} className="rounded-lg bg-b4 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={`https://osu.ppy.sh/beatmapsets/${set.setId}`}
              rel="noreferrer"
              className="font-bold text-c1 hover:underline"
            >
              {`${set.artist} - ${set.title}`}
            </a>
            <Tag tone="plain">{set.status}</Tag>
            {set.unranked ? <Tag tone="warn">Unranked</Tag> : null}
            {set.check ? <Tag tone="warn">Check first</Tag> : null}
          </div>
          <p className="text-c3 text-sm">Mapped by {set.creator}</p>
          {set.check ? <p className="text-amber-200 text-sm">{set.check.text}</p> : null}
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {set.maps.map((map) => (
              <li key={map.id} className="flex flex-wrap gap-x-2 text-c2">
                <span className="font-bold">{map.version}</span>
                <span>
                  {`${starsText(map.stars)} (no mod) · ${formatDuration(map.length)} · ${formatBpm(map.bpm)} BPM`}
                </span>
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
