/**
 * @file src/components/builder/MapBrowserPane.tsx
 * @desc The editor's map browser (GET /api/maps/browse): filters under a mod lens, results with
 *       values under it, and Add on each difficulty. Its props are the editor's interface: the
 *       pool's buckets and beatmap ids ("hide maps in this pool", "In this pool"), the bucket a
 *       "Find maps" opened it for (its mods set the lens, Qualified and Pending go back to Ranked,
 *       and Add goes there while the lens is the one it set or still matches; its target's star
 *       range, when it has one, becomes the star filter), a count that
 *       brings focus here on each press, and onAdd. Its state lives in the editor URL's `browse`
 *       param (read once mounted, written with history.replaceState so the page doesn't reload),
 *       so a refresh keeps it. The lenses come from the answer, and so does the lens Add and the
 *       range labels go by (the page on screen is under it, even while a new lens loads); when
 *       the answer to the current search is under another lens (one the mirror doesn't offer),
 *       the state snaps to it. Retry after a failure puts focus on the pane's heading, since
 *       the failure view (and its button) goes while the search runs. In the editor (`candidate`)
 *       each difficulty also has "Add as candidate", and a Source choice switches to "Your
 *       candidates" (YourCandidates; the search waits meanwhile). Find similar (on its own rows,
 *       or the editor's slots and candidates through `similar`) switches to "Similar to <map>"
 *       (SimilarMaps) under the current lens, the default bucket's target star range and, in the
 *       editor, without the pool's maps, with "Leaderboard maps only" from the browse state;
 *       Back to search returns to the search as it was.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Mon Sep 28, 2026
 */

"use client";

import type { BucketEntry } from "@haruhimemoe/pool";
import { Card, ChoiceChips } from "@haruhimemoe/ui";
import { useEffect, useId, useRef, useState } from "react";
import { BrowseFilters } from "@/components/builder/BrowseFilters";
import { BrowseResults } from "@/components/builder/BrowseResults";
import { SimilarMaps } from "@/components/builder/SimilarMaps";
import { YourCandidates } from "@/components/builder/YourCandidates";
import { BROWSE_LENSES } from "@/constants/browse";
import { SEARCH_FAILED_COUNT } from "@/constants/search";
import { FindSimilarContext } from "@/hooks/useFindSimilar";
import { useMapBrowse } from "@/hooks/useMapBrowse";
import type { BucketTargets } from "@/schemas/built-plan";
import type { CandidateAdder } from "@/schemas/candidate-editor";
import { defaultBucketFor, findMapsState, lensForBucket, type OpenedFor } from "@/utils/browse-add";
import {
  type BrowseSource,
  browseSources,
  DEFAULT_BROWSE_STATE,
  editorSearchFor,
  isLensStatus,
  lensOf,
  readBrowseState,
} from "@/utils/browse-state";
import { type SimilarTarget, similarQueryFor } from "@/utils/similar-params";

/**
 * The map browser's interface: the pool's buckets and maps, the bucket Find maps opened it for, and
 * the add call.
 */
export type MapBrowserProps = {
  buckets: readonly BucketEntry[];
  /** Every beatmap id in the pool now. */
  poolIds: readonly number[];
  /** The bucket whose "Find maps" opened the browser, or null. */
  openedFor: string | null;
  /** Goes up by one on every "Find maps" press, so each one brings focus here. */
  openCount: number;
  /** Adds a map to a bucket (null: no slot), at its end. */
  onAdd: (beatmapId: number, bucket: string | null) => void;
  /** "Add as candidate" and the "Your candidates" source (the editor). */
  candidate?: (CandidateAdder & { poolId: string; refresh: number }) | undefined;
  /** The pool's targets: Find maps on a bucket with a star range puts it in the star filter. */
  targets?: BucketTargets | undefined;
  /** The editor's last Find similar (a slot or candidate) and a count that goes up with each. */
  similar?: { target: SimilarTarget; count: number } | undefined;
  /** fetch (tests; the editor passes its own). */
  fetcher?: typeof fetch;
};

/**
 * @function MapBrowserPane
 * @param props {MapBrowserProps} the pool's buckets, its map ids, Find maps' bucket and the add
 *        call
 * @returns {JSX.Element} the map browser: filters, ranges, results and paging
 */
export function MapBrowserPane(props: MapBrowserProps) {
  const { buckets, poolIds, openedFor, openCount, onAdd, fetcher, targets, candidate } = props;
  const { similar } = props;
  const headingId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const [state, setState] = useState(DEFAULT_BROWSE_STATE);
  const [urlRead, setUrlRead] = useState(false);
  const [opened, setOpened] = useState<OpenedFor | null>(null);
  const [source, setSource] = useState<BrowseSource>("search");
  const [similarTo, setSimilarTo] = useState<SimilarTarget | null>(null);
  const browse = useMapBrowse(state, poolIds, {
    // Your candidates on screen: the search waits.
    enabled: urlRead && source === "search",
    ...(fetcher ? { fetcher } : {}),
  });
  const lenses = browse.data?.lenses ?? BROWSE_LENSES;
  const lensList = useRef<readonly string[]>(lenses);
  lensList.current = lenses;

  useEffect(() => {
    setState(readBrowseState(window.location.search));
    setUrlRead(true);
  }, []);

  useEffect(() => {
    if (!urlRead) return;
    const { pathname, search, hash } = window.location;
    const next = editorSearchFor(search, state);
    if (next !== search)
      window.history.replaceState(window.history.state, "", `${pathname}${next}${hash}`);
  }, [state, urlRead]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: each "Find maps" press, not every bucket change.
  useEffect(() => {
    if (openCount === 0) return;
    const entry = buckets.find((bucket) => bucket.code === openedFor);
    if (entry) {
      const sr = targets?.[entry.code]?.sr;
      setState((s) => findMapsState(s, entry, lensList.current, sr));
      setOpened({ bucket: entry.code, lens: lensForBucket(entry, lensList.current) });
    }
    heading.current?.focus();
  }, [openCount]);

  const openSimilar = (target: SimilarTarget) => {
    setSimilarTo(target);
    setSource("similar");
    heading.current?.focus();
  };
  // biome-ignore lint/correctness/useExhaustiveDependencies: each editor Find similar press.
  useEffect(() => {
    if (similar && similar.count > 0) openSimilar(similar.target);
  }, [similar?.count]);

  const answered = browse.data?.lens ?? null;
  useEffect(() => {
    if (!browse.fresh || answered === null || !isLensStatus(state.status)) return;
    if (answered !== state.lens) setState((s) => ({ ...s, lens: answered }));
  }, [browse.fresh, answered, state.status, state.lens]);

  const lens = answered ?? lensOf(state);
  const count =
    browse.status === "error"
      ? SEARCH_FAILED_COUNT
      : browse.status === "loading" || !browse.data
        ? "Searching…"
        : `${browse.data.sets.length} ${browse.data.sets.length === 1 ? "set" : "sets"} on this page`;
  const defaultBucket = defaultBucketFor(lens, buckets, opened);
  const cards = { buckets, defaultBucket, poolIds: new Set(poolIds), onAdd, candidate };
  const sources = browseSources(candidate !== undefined, similarTo !== null);
  return (
    <FindSimilarContext value={openSimilar}>
      <Card aria-labelledby={headingId} id="map-browser">
        <h2 id={headingId} ref={heading} tabIndex={-1} className="mb-3 font-bold text-c1 text-lg">
          Find maps
        </h2>
        <div className="flex flex-col gap-4">
          {sources.length > 1 ? (
            <ChoiceChips label="Source" options={sources} value={source} onChange={setSource} />
          ) : null}
          {similarTo && source === "similar" ? (
            <SimilarMaps
              key={similarTo.id}
              target={similarTo}
              query={similarQueryFor(
                lens,
                defaultBucket,
                targets,
                candidate?.poolId,
                state.similarLeaderboardOnly,
              )}
              {...cards}
              onBack={() => setSource("search")}
              onLeaderboardOnly={(on) => setState((s) => ({ ...s, similarLeaderboardOnly: on }))}
              fetcher={fetcher}
            />
          ) : candidate && source === "candidates" ? (
            <YourCandidates
              poolId={candidate.poolId}
              {...cards}
              under={defaultBucket ?? "NM"}
              adder={candidate}
              refresh={candidate.refresh}
              fetcher={fetcher}
            />
          ) : (
            <>
              <BrowseFilters
                state={state}
                lenses={lenses}
                valuesLens={lens}
                onChange={setState}
                resultCount={count}
              />
              <BrowseResults
                // Retry's failure view goes while the search runs: focus waits on the heading.
                browse={{
                  ...browse,
                  retry: () => {
                    heading.current?.focus();
                    browse.retry();
                  },
                }}
                {...cards}
                onPage={(page) => setState((s) => ({ ...s, page }))}
              />
            </>
          )}
        </div>
      </Card>
    </FindSimilarContext>
  );
}
