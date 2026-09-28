/**
 * @file src/hooks/useSlotValues.ts
 * @desc The editor's values under each slot's mods. Starts from what the page read; when a slot
 *       on screen has a map and combo with no values yet (a map added, or moved to a slot with
 *       other mods) and the editor has nothing left to save, it asks GET /api/pools/<id>/values
 *       once for them (the server answers from the saved pool, so it waits for the save). A key
 *       the answer still lacks isn't asked for again; its slot shows the no-mod values.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

"use client";

import type { BucketEntry, PoolSlot } from "@haruhimemoe/pool";
import { useEffect, useRef, useState } from "react";
import { callPools, type Fetcher } from "@/lib/pool-client";
import { builtSlotCode, type SlotValueMap, slotValueKey } from "@/utils/slot-values";

type ValuesBody = { values: SlotValueMap; complete: boolean };

/**
 * @function useSlotValues
 * @param pool {{ id: string; buckets: readonly BucketEntry[]; slots: readonly PoolSlot[] }} the
 *        pool on screen
 * @param initial {SlotValueMap} what the page read
 * @param settled {boolean} nothing is waiting to be saved
 * @param fetcher {Fetcher} fetch (tests)
 * @returns {SlotValueMap} every value known so far
 */
export const useSlotValues = (
  pool: { id: string; buckets: readonly BucketEntry[]; slots: readonly PoolSlot[] },
  initial: SlotValueMap,
  settled: boolean,
  fetcher: Fetcher = fetch,
): SlotValueMap => {
  const [values, setValues] = useState<SlotValueMap>(initial);
  const asked = useRef(new Set<string>());
  const asking = useRef(false);
  const missing = pool.slots
    .map((slot) => slotValueKey(slot.beatmapId, builtSlotCode(slot, pool.buckets)))
    .filter((key) => !(key in values) && !asked.current.has(key))
    .join(",");
  useEffect(() => {
    if (missing === "" || !settled || asking.current) return;
    asking.current = true;
    for (const key of missing.split(",")) asked.current.add(key);
    void callPools<ValuesBody>(fetcher, `/api/pools/${pool.id}/values`).then((answer) => {
      asking.current = false;
      if (answer.ok && answer.body?.values) {
        const found = answer.body.values;
        setValues((was) => ({ ...was, ...found }));
      }
    });
  }, [missing, settled, pool.id, fetcher]);
  return values;
};
