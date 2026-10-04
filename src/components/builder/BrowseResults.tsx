/**
 * @file src/components/builder/BrowseResults.tsx
 * @desc The map browser's results: loading, the failure ("Map search isn't working right now."
 *       with Retry, no stale sets), nothing found, or the sets; above them what the page left
 *       out (sets not allowed in officially supported tournaments, difficulties the filters
 *       under the lens took off this page, the pool's maps, maps past pools played) and the
 *       unranked warning; below them Previous and Next (buttons, so the editor stays put) and
 *       where mod values come from. Presentational.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Oct 4, 2026
 */

"use client";

import type { BucketEntry } from "@haruhimemoe/pool";
import { Button, cx, Notice, Pagination } from "@haruhimemoe/ui";
import { BrowseSetCard } from "@/components/builder/BrowseSetCard";
import { MOD_VALUES_NOTE } from "@/constants/browse";
import { hiddenSetsText, MAX_SEARCH_PAGE, UNRANKED_WARNING } from "@/constants/search";
import type { MapBrowse } from "@/hooks/useMapBrowse";
import type { CandidateAdder } from "@/schemas/candidate-editor";
import type { BrowseResponse } from "@/utils/browse-params";

type BrowseResultsProps = {
  browse: MapBrowse;
  buckets: readonly BucketEntry[];
  defaultBucket: string | null;
  poolIds: ReadonlySet<number>;
  onAdd: (beatmapId: number, bucket: string | null) => void;
  /** "Add as candidate" (the editor). */
  candidate?: CandidateAdder | undefined;
  onPage: (page: number) => void;
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** What the page left out, one line each. */
const leftOut = (data: BrowseResponse): string[] =>
  [
    data.hidden > 0 ? `${hiddenSetsText(data.hidden)}.` : "",
    data.filteredOnPage > 0
      ? `${plural(data.filteredOnPage, "difficulty", "difficulties")} on this page didn't match the filters under ${data.lens}.`
      : "",
    data.excluded > 0 ? `${plural(data.excluded, "map", "maps")} in this pool left out.` : "",
    data.playedHidden > 0
      ? `${plural(data.playedHidden, "map", "maps")} played in past pools left out.`
      : "",
  ].filter(Boolean);

/**
 * @function BrowseResults
 * @param props {BrowseResultsProps} the search, the page change and each card's add props
 * @returns {JSX.Element} what the page left out, the sets, the pager and the note
 */
export function BrowseResults({ browse, onPage, ...cards }: BrowseResultsProps) {
  const { status, data, error } = browse;
  if (status === "error") {
    return (
      <div className="flex flex-col gap-2">
        <Notice tone="error">{error}</Notice>
        <Button variant="secondary" onClick={browse.retry}>
          Retry
        </Button>
      </div>
    );
  }
  if (!data) return <p className="text-c3 text-sm">Loading maps…</p>;
  const lastPage = Math.min(
    data.pageCount ?? data.page + (data.sets.length > 0 ? 1 : 0),
    MAX_SEARCH_PAGE,
  );
  return (
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
        <p className="text-c2 text-sm">
          No maps on this page match. Try fewer filters or another lens.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {data.sets.map((set) => (
            <BrowseSetCard key={set.setId} set={set} lens={data.lens} {...cards} />
          ))}
        </ul>
      )}
      <Pagination
        aria-label="Map pages"
        page={data.page}
        pageCount={data.pageCount === null ? null : Math.max(lastPage, 1)}
        hasNext={data.page < lastPage}
        onPageChange={onPage}
      />
      <p className="text-c3 text-xs">{MOD_VALUES_NOTE}</p>
    </div>
  );
}
