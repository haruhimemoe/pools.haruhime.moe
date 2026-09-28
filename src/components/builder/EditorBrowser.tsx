/**
 * @file src/components/builder/EditorBrowser.tsx
 * @desc The map browser as the editor uses it: Add makes a map a bucket's pick, and Add as
 *       candidate (from a search or from "Your candidates") adds it to the chosen slot's
 *       candidates, its note along when it has one. Presentational glue over MapBrowserPane.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

"use client";

import { MapBrowserPane } from "@/components/builder/MapBrowserPane";
import type { Fetcher } from "@/lib/pool-client";
import type { PoolOp } from "@/schemas/built-pool-ops";
import type { ClientPool } from "@/schemas/built-pool-view";
import { candidateSlotOptions } from "@/utils/candidate-view";

type EditorBrowserProps = {
  pool: ClientPool;
  change: (ops: PoolOp[]) => boolean;
  /** The bucket whose "Find maps" opened the browser, or null. */
  openedFor: string | null;
  /** Goes up by one on every "Find maps" press. */
  openCount: number;
  fetcher?: Fetcher | undefined;
};

/**
 * @function EditorBrowser
 * @param props {EditorBrowserProps} the pool, the change call, Find maps' bucket and count
 * @returns {JSX.Element} the map browser wired to the editor's ops
 */
export function EditorBrowser({ pool, change, openedFor, openCount, fetcher }: EditorBrowserProps) {
  return (
    <MapBrowserPane
      buckets={pool.buckets}
      poolIds={pool.slots.map((slot) => slot.beatmapId)}
      openedFor={openedFor}
      openCount={openCount}
      onAdd={(beatmapId, bucket) => change([{ type: "addMap", beatmapId, bucket }])}
      candidate={{
        poolId: pool.id,
        refresh: pool.version,
        options: candidateSlotOptions(pool),
        onAdd: ({ beatmapId, beatmapsetId, note }, slot) =>
          change([
            { type: "addCandidate", slot, beatmapId, beatmapsetId, ...(note ? { note } : {}) },
          ]),
      }}
      targets={pool.targets}
      {...(fetcher ? { fetcher } : {})}
    />
  );
}
