/**
 * @file src/hooks/useSlotMaps.ts
 * @desc The editor's map details. It starts with what the page read from the maps collection;
 *       when the pool holds a map it has never asked about (a paste, another editor's change),
 *       it asks GET /api/pools/<id>/maps (which fills maps pools never saw from the mirror), one
 *       request at a time. A map nobody knows, or a request that fails, is kept as null so it
 *       isn't asked about again on every change.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

"use client";

import type { PoolSlot } from "@haruhimemoe/pool";
import { useEffect, useRef, useState } from "react";
import { callPools, type Fetcher } from "@/lib/pool-client";
import type { BuiltMap, BuiltMaps } from "@/schemas/built-pool-view";
import { unknownMapIds } from "@/utils/built-editor";

/**
 * @function useSlotMaps
 * @param poolId {string} the pool being edited
 * @param slots {readonly PoolSlot[]} its slots on screen
 * @param initial {BuiltMaps} what the page read
 * @param fetcher {Fetcher} fetch (tests)
 * @returns {BuiltMaps} every map's details known so far
 */
export const useSlotMaps = (
  poolId: string,
  slots: readonly PoolSlot[],
  initial: BuiltMaps,
  fetcher: Fetcher = fetch,
): BuiltMaps => {
  const [maps, setMaps] = useState<BuiltMaps>(initial);
  const asking = useRef(false);
  const missing = unknownMapIds(slots, maps).join(",");
  useEffect(() => {
    if (missing === "" || asking.current) return;
    asking.current = true;
    const ids = missing.split(",").map(Number);
    void callPools<{ maps: BuiltMap[] }>(fetcher, `/api/pools/${poolId}/maps`).then((answer) => {
      asking.current = false;
      setMaps((was) => {
        const next: Record<number, BuiltMap | null> = { ...was };
        if (answer.ok) for (const map of answer.body.maps) next[map.id] = map;
        for (const id of ids) if (!(id in next)) next[id] = null;
        return next;
      });
    });
  }, [missing, poolId, fetcher]);
  return maps;
};
