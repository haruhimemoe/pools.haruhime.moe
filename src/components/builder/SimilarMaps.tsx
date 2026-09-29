/**
 * @file src/components/builder/SimilarMaps.tsx
 * @desc The map browser's "Similar to <map>" source (GET /api/maps/<id>/similar, useSimilarMaps):
 *       which method found them ("Pattern match" from BoBERT, or the "Difficulty match"
 *       fallback) and what that means, BoBERT's credit, what the filters left out, then the
 *       sets as the search shows them, each difficulty with its similarity, Add, Add as candidate
 *       and Find similar (which moves this source to that map). "Leaderboard maps only" (on by
 *       default) keeps ranked, approved and loved maps and says how many it left out. "Back to search" returns to the
 *       search as it was. A failure says so with Retry.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

"use client";

import type { BucketEntry } from "@haruhimemoe/pool";
import { Badge, Button, Checkbox, cx, Notice } from "@haruhimemoe/ui";
import { BrowseSetCard } from "@/components/builder/BrowseSetCard";
import { SimilarCredit } from "@/components/builder/SimilarCredit";
import { hiddenSetsText, UNRANKED_WARNING } from "@/constants/search";
import {
  SIMILAR_EMPTY,
  SIMILAR_LEADERBOARD_LABEL,
  SIMILAR_METHOD_TEXT,
  similarUnrankedText,
} from "@/constants/similar";
import { useSimilarMaps } from "@/hooks/useSimilarMaps";
import type { Fetcher } from "@/lib/pool-client";
import type { CandidateAdder } from "@/schemas/candidate-editor";
import type { SimilarQuery, SimilarResponse, SimilarTarget } from "@/utils/similar-params";

type SimilarMapsProps = {
  target: SimilarTarget;
  query: SimilarQuery;
  buckets: readonly BucketEntry[];
  defaultBucket: string | null;
  poolIds: ReadonlySet<number>;
  onAdd: (beatmapId: number, bucket: string | null) => void;
  candidate?: CandidateAdder | undefined;
  onBack: () => void;
  /** Turns "Leaderboard maps only" on or off (the browser keeps it in its URL state). */
  onLeaderboardOnly: (on: boolean) => void;
  fetcher?: Fetcher | undefined;
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** What the answer left out, one line each. */
const leftOut = (data: SimilarResponse): string[] =>
  [
    data.unranked > 0
      ? similarUnrankedText(
          data.unranked,
          data.total,
          data.sets.reduce((sum, set) => sum + set.diffs.length, 0),
        )
      : "",
    data.hidden > 0 ? `${hiddenSetsText(data.hidden)}.` : "",
    data.excluded > 0 ? `${plural(data.excluded, "map", "maps")} in this pool left out.` : "",
    data.filtered > 0
      ? `${plural(data.filtered, "map", "maps")} outside the star range under ${data.lens} left out.`
      : "",
    data.missing > 0 ? `${plural(data.missing, "map", "maps")} the mirror doesn't have.` : "",
  ].filter(Boolean);

/**
 * @function SimilarMaps
 * @param props {SimilarMapsProps} the map, the lens and range, and each card's add props
 * @returns {JSX.Element} the method, the credit, the sets and Back to search
 */
export function SimilarMaps(props: SimilarMapsProps) {
  const { target, query, onBack, onLeaderboardOnly, fetcher, ...cards } = props;
  const similar = useSimilarMaps(target.id, query, fetcher);
  const { status, data } = similar;
  const method = data ? SIMILAR_METHOD_TEXT[data.method] : null;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="min-w-0 break-words font-bold text-c1">{`Similar to ${target.label}`}</h3>
        <Button variant="secondary" onClick={onBack}>
          Back to search
        </Button>
      </div>
      {method ? (
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={data?.method === "pattern" ? "accent" : "neutral"}>{method.label}</Badge>
            <span className="text-c3 text-sm">
              {`Under ${data?.lens === "NM" ? "no mod" : data?.lens}`}
            </span>
          </div>
          <p className="text-c2 text-sm">{method.about}</p>
        </div>
      ) : null}
      <SimilarCredit />
      <Checkbox
        id="similar-leaderboard-only"
        label={SIMILAR_LEADERBOARD_LABEL}
        checked={query.leaderboardOnly}
        onChange={(event) => onLeaderboardOnly(event.target.checked)}
      />
      {status === "error" ? (
        <div className="flex flex-col gap-2">
          <Notice tone="error">{similar.message}</Notice>
          <Button variant="secondary" className="self-start" onClick={similar.retry}>
            Retry
          </Button>
        </div>
      ) : !data ? (
        <p className="text-c3 text-sm" aria-live="polite">
          Finding similar maps…
        </p>
      ) : (
        <div className={cx("flex flex-col gap-3", status === "loading" && "opacity-60")}>
          {leftOut(data).map((line) => (
            <p key={line} className="text-c3 text-sm">
              {line}
            </p>
          ))}
          {data.sets.some((set) => set.unranked) ? (
            <p className="text-amber-200 text-sm">{UNRANKED_WARNING}</p>
          ) : null}
          {data.sets.length === 0 ? (
            <p className="text-c2 text-sm">{SIMILAR_EMPTY}</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {data.sets.map((set) => (
                <BrowseSetCard key={set.setId} set={set} lens={data.lens} {...cards} />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
