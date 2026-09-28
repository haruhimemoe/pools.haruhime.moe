/**
 * @file src/components/builder/MapBrowserPane.tsx
 * @desc Where the map browser goes (build step 5): for now a labeled placeholder that points to
 *       the paste box. Its props are the browser's interface: the pool's buckets and beatmap ids
 *       (for "in this pool" and "hide maps in this pool"), the bucket a "Find maps" button opened
 *       it for (its mods set the lens), and `onAdd(beatmapId, bucket)`, which the editor turns
 *       into an addMap change. Each "Find maps" press brings focus here.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

"use client";

import type { BucketEntry } from "@haruhimemoe/pool";
import { Card } from "@haruhimemoe/ui";
import { useEffect, useId, useRef } from "react";

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
};

export function MapBrowserPane({ openedFor, openCount }: MapBrowserProps) {
  const headingId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (openCount > 0) heading.current?.focus();
  }, [openCount]);
  return (
    <Card aria-labelledby={headingId} id="map-browser">
      <h2 id={headingId} ref={heading} tabIndex={-1} className="mb-2 font-bold text-c1 text-lg">
        Find maps (coming next)
      </h2>
      <p className="text-c2 text-sm">
        Searching osu! maps with a mod lens, and adding them to a slot from here, comes in the next
        update. Until then, paste beatmap IDs or links in the paste box.
      </p>
      {openedFor ? <p className="mt-2 text-c3 text-sm">Opened for {openedFor}.</p> : null}
    </Card>
  );
}
