/**
 * @file src/components/builder/BrowseSetCard.tsx
 * @desc One beatmapset in the map browser: its cover and preview clip (straight from osu!'s CDN),
 *       artist, title (a link to it on osu!), mapper, its
 *       status, an Unranked tag and "Check first" with why; then each osu!standard difficulty
 *       with its values under the lens (stars, with the no-mod rating small beside them when
 *       they differ; AR, OD, CS, BPM, length; under a mod lens, "no mod data" beside AR, OD and CS
 *       the mirror had no values for, so they're worked out), how many past pools played it (a
 *       link to its map page), and Add (which says "In this pool" for a map the pool has).
 *       Presentational.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Mon Sep 28, 2026
 */

import { formatBpm, formatDuration, formatStat } from "@haruhimemoe/osu/format";
import type { BucketEntry } from "@haruhimemoe/pool";
import Link from "next/link";
import { AddToPool } from "@/components/builder/AddToPool";
import { MapPreview } from "@/components/builder/MapPreview";
import { SET_STATUS_LABELS } from "@/constants/search";
import type { BrowseDiff, BrowseSet } from "@/utils/browse-params";
import { starsText } from "@/utils/pool-text";

type BrowseSetCardProps = {
  set: BrowseSet;
  /** The lens the page is under. */
  lens: string;
  buckets: readonly BucketEntry[];
  defaultBucket: string | null;
  poolIds: ReadonlySet<number>;
  onAdd: (beatmapId: number, bucket: string | null) => void;
};

const TAG = "rounded-full px-2 py-0.5 text-xs";
const WARN = `${TAG} bg-amber-300/20 font-bold text-amber-200`;

const stat = (name: string, value: number | null) =>
  `${name} ${value === null ? "?" : formatStat(value)}`;

const played = ({ id, playedIn }: BrowseDiff) => {
  if (playedIn === null) return <span>Pool history unavailable</span>;
  if (playedIn === 0) return <span>Not played in a past pool</span>;
  return (
    <Link href={`/maps/${id}`} className="text-h1 hover:underline">
      Played in {playedIn} past {playedIn === 1 ? "pool" : "pools"}
    </Link>
  );
};

export function BrowseSetCard(props: BrowseSetCardProps) {
  const { set, lens, buckets, defaultBucket, poolIds, onAdd } = props;
  return (
    <li className="rounded-lg bg-b4 p-3">
      <div className="flex gap-3">
        <MapPreview setId={set.setId} song={`${set.artist} - ${set.title}`} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={`https://osu.ppy.sh/beatmapsets/${set.setId}`}
              rel="noreferrer"
              className="font-bold text-c1 hover:underline"
            >
              {`${set.artist} - ${set.title}`}
            </a>
            <span className={`${TAG} bg-b3 text-c2`}>
              {SET_STATUS_LABELS[set.status] ?? set.status}
            </span>
            {set.unranked ? <span className={WARN}>Unranked</span> : null}
            {set.check ? <span className={WARN}>Check first</span> : null}
          </div>
          <p className="text-c3 text-sm">Mapped by {set.creator}</p>
        </div>
      </div>
      {set.check ? <p className="text-amber-200 text-sm">{set.check.text}</p> : null}
      <ul className="mt-2 flex flex-col gap-3 text-sm">
        {set.diffs.map((diff) => (
          <li key={diff.id} data-diff={diff.id} className="flex flex-col gap-1">
            <div className="flex flex-wrap items-baseline gap-x-2 text-c2">
              <span className="font-bold text-c1">{diff.version}</span>
              <span>
                {starsText(diff.stars)}
                {diff.starsNoMod !== diff.stars ? (
                  <span className="text-c3 text-xs"> ({starsText(diff.starsNoMod)} no mod)</span>
                ) : null}
              </span>
              <span>
                {[stat("AR", diff.ar), stat("OD", diff.od), stat("CS", diff.cs)].join(" · ")}
                {diff.source === "math" && lens !== "NM" ? (
                  <span className="text-c3 text-xs"> (no mod data)</span>
                ) : null}
              </span>
              <span>{`${formatBpm(diff.bpm)} BPM · ${formatDuration(diff.length)}`}</span>
            </div>
            <div className="text-c3">{played(diff)}</div>
            <AddToPool
              beatmapId={diff.id}
              version={diff.version}
              buckets={buckets}
              defaultBucket={defaultBucket}
              inPool={poolIds.has(diff.id)}
              onAdd={onAdd}
            />
          </li>
        ))}
      </ul>
    </li>
  );
}
