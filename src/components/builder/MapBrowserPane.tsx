/**
 * @file src/components/builder/MapBrowserPane.tsx
 * @desc The editor's map browser (GET /api/maps/browse): filters under a mod lens, results with
 *       values under it, and Add on each difficulty. Its props are the editor's interface: the
 *       pool's buckets and beatmap ids ("hide maps in this pool", "In this pool"), the bucket a
 *       "Find maps" opened it for (its mods set the lens, and Add goes there while the lens still
 *       matches), a count that brings focus here on each press, and onAdd. Its state lives in the
 *       editor URL's `browse` param (read once mounted, written with history.replaceState so the
 *       page doesn't reload), so a refresh keeps it. The lenses come from the answer.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

"use client";

import type { BucketEntry } from "@haruhimemoe/pool";
import { Card } from "@haruhimemoe/ui";
import { useEffect, useId, useRef, useState } from "react";
import { BrowseFilters } from "@/components/builder/BrowseFilters";
import { BrowseResults } from "@/components/builder/BrowseResults";
import { BROWSE_LENSES } from "@/constants/browse";
import { SEARCH_FAILED_COUNT } from "@/constants/search";
import { useMapBrowse } from "@/hooks/useMapBrowse";
import { defaultBucketFor, lensForBucket } from "@/utils/browse-add";
import {
  DEFAULT_BROWSE_STATE,
  editorSearchFor,
  lensOf,
  readBrowseState,
} from "@/utils/browse-state";

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
  /** fetch (tests; the editor passes its own). */
  fetcher?: typeof fetch;
};

export function MapBrowserPane(props: MapBrowserProps) {
  const { buckets, poolIds, openedFor, openCount, onAdd, fetcher } = props;
  const headingId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const [state, setState] = useState(DEFAULT_BROWSE_STATE);
  const [urlRead, setUrlRead] = useState(false);
  const browse = useMapBrowse(state, poolIds, {
    enabled: urlRead,
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
    if (entry) setState((s) => ({ ...s, lens: lensForBucket(entry, lensList.current), page: 1 }));
    heading.current?.focus();
  }, [openCount]);

  const lens = lensOf(state);
  const count =
    browse.status === "error"
      ? SEARCH_FAILED_COUNT
      : browse.status === "loading" || !browse.data
        ? "Searching…"
        : `${browse.data.sets.length} ${browse.data.sets.length === 1 ? "set" : "sets"} on this page`;
  return (
    <Card aria-labelledby={headingId} id="map-browser">
      <h2 id={headingId} ref={heading} tabIndex={-1} className="mb-3 font-bold text-c1 text-lg">
        Find maps
      </h2>
      <div className="flex flex-col gap-4">
        <BrowseFilters state={state} lenses={lenses} onChange={setState} resultCount={count} />
        <BrowseResults
          browse={browse}
          buckets={buckets}
          defaultBucket={defaultBucketFor(lens, buckets, openedFor)}
          poolIds={new Set(poolIds)}
          onAdd={onAdd}
          onPage={(page) => setState((s) => ({ ...s, page }))}
        />
      </div>
    </Card>
  );
}
