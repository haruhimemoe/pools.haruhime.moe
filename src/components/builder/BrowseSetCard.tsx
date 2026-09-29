/**
 * @file src/components/builder/BrowseSetCard.tsx
 * @desc One beatmapset in the map browser: its cover and preview clip (straight from osu!'s CDN),
 *       artist, title (a link to it on osu!), mapper, its
 *       status, an Unranked tag and "Check first" with why; then each osu!standard difficulty
 *       with its values under the lens (stars, with the no-mod rating small beside them when
 *       they differ; AR, OD, CS, BPM, length; under a mod lens, "no mod data" beside AR, OD and CS
 *       the mirror had no values for, so they're worked out), how many past pools played it (a
 *       link to its map page), and Add (which says "In this pool" for a map the pool has). In
 *       the "Similar to" source each difficulty also says how similar it is, and every row can
 *       Find similar. Presentational.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Mon Sep 28, 2026
 */

import type { BucketEntry } from "@haruhimemoe/pool";
import { Badge, BeatmapStats, TextLink } from "@haruhimemoe/ui";
import { AddAsCandidate } from "@/components/builder/AddAsCandidate";
import { AddToPool } from "@/components/builder/AddToPool";
import { FindSimilarButton } from "@/components/builder/FindSimilarButton";
import { MapPreview } from "@/components/builder/MapPreview";
import { StarsUnder } from "@/components/maps/StarsUnder";
import { SET_STATUS_LABELS } from "@/constants/search";
import type { CandidateAdder } from "@/schemas/candidate-editor";
import type { BrowseDiff, BrowseSet } from "@/utils/browse-params";
import { mapLabel } from "@/utils/map-record";
import { starsText } from "@/utils/pool-text";
import type { SimilarSet } from "@/utils/similar-params";

type BrowseSetCardProps = {
  /** A search's set, or a "Similar to" set whose difficulties say how similar they are. */
  set: BrowseSet | SimilarSet;
  /** The lens the page is under. */
  lens: string;
  buckets: readonly BucketEntry[];
  defaultBucket: string | null;
  poolIds: ReadonlySet<number>;
  onAdd: (beatmapId: number, bucket: string | null) => void;
  /** "Add as candidate" (the editor). */
  candidate?: CandidateAdder | undefined;
};

const similarityOf = (diff: BrowseDiff): number | null =>
  "similarity" in diff && typeof diff.similarity === "number" ? diff.similarity : null;

const played = ({ id, playedIn }: BrowseDiff) => {
  if (playedIn === null) return <span>Pool history unavailable</span>;
  if (playedIn === 0) return <span>Not played in a past pool</span>;
  return (
    <TextLink href={`/maps/${id}`}>
      Played in {playedIn} past {playedIn === 1 ? "pool" : "pools"}
    </TextLink>
  );
};

/**
 * @function BrowseSetCard
 * @param props {BrowseSetCardProps} the set, the lens and the add props
 * @returns {JSX.Element} one set with its tags and each difficulty's values, played count and Add
 */
export function BrowseSetCard(props: BrowseSetCardProps) {
  const { set, lens, buckets, defaultBucket, poolIds, onAdd, candidate } = props;
  return (
    <li className="rounded-lg bg-b4 p-3">
      <div className="flex gap-3">
        <MapPreview setId={set.setId} song={`${set.artist} - ${set.title}`} />
        <div className="min-w-0">
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
        </div>
      </div>
      {set.check ? <p className="text-amber-200 text-sm">{set.check.text}</p> : null}
      <ul className="mt-2 flex flex-col gap-3 text-sm">
        {set.diffs.map((diff: BrowseDiff) => (
          <li key={diff.id} data-diff={diff.id} className="flex flex-col gap-1">
            <div className="flex flex-wrap items-baseline gap-x-2 text-c2">
              {similarityOf(diff) === null ? null : (
                <Badge tone="accent">{`${similarityOf(diff)}% similar`}</Badge>
              )}
              <span className="font-bold text-c1">{diff.version}</span>
              <StarsUnder
                stars={diff.stars}
                under={
                  diff.starsNoMod !== diff.stars
                    ? `${lens} (${starsText(diff.starsNoMod)} no mod)`
                    : lens === "NM"
                      ? "no mod"
                      : lens
                }
              />
              <BeatmapStats
                cs={diff.cs}
                ar={diff.ar}
                od={diff.od}
                bpm={diff.bpm}
                lengthSeconds={diff.length}
                className="text-sm"
              />
              {diff.source === "math" && lens !== "NM" ? (
                <span className="text-c3 text-xs">(no mod data)</span>
              ) : null}
            </div>
            <div className="text-c3">{played(diff)}</div>
            <div className="flex flex-wrap items-start gap-2">
              <AddToPool
                beatmapId={diff.id}
                version={diff.version}
                buckets={buckets}
                defaultBucket={defaultBucket}
                inPool={poolIds.has(diff.id)}
                onAdd={onAdd}
              />
              {candidate ? (
                <AddAsCandidate
                  beatmapId={diff.id}
                  beatmapsetId={set.setId}
                  version={diff.version}
                  defaultBucket={defaultBucket}
                  adder={candidate}
                />
              ) : null}
              <FindSimilarButton
                beatmapId={diff.id}
                label={mapLabel({ ...set, version: diff.version }, diff.id)}
              />
            </div>
          </li>
        ))}
      </ul>
    </li>
  );
}
