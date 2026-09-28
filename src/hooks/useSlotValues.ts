/**
 * @file src/hooks/useSlotValues.ts
 * @desc The editor's values under each slot's mods. Starts from what the page read; when a slot
 *       on screen has a map and combo with no values yet (a map added, or moved to a slot with
 *       other mods) and the editor has nothing left to save, it asks GET /api/pools/<id>/values
 *       for them (the server answers from the saved pool, so it waits for the save). Keys count
 *       as asked only once an ok answer came: a key that answer still lacks isn't asked for
 *       again (its slot shows the no-mod values). A failed answer tries again after 2 s,
 *       doubling up to a minute (not after a 401, 403 or 404: the pool is gone for this user).
 *       A map added while a request is out is asked for after it.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

"use client";

import type { BucketEntry, PoolSlot } from "@haruhimemoe/pool";
import { useEffect, useRef, useState } from "react";
import { VALUES_RETRY_MAX_MS, VALUES_RETRY_MS } from "@/constants/built-pools";
import { callPools, type Fetcher } from "@/lib/pool-client";
import { builtSlotCode, type SlotValueMap, slotValueKey } from "@/utils/slot-values";

type ValuesBody = { values: SlotValueMap; complete: boolean };

/** Answers that mean this user won't get values for the pool by asking again. */
const FINAL = new Set([401, 403, 404]);

/**
 * @function useSlotValues
 * @param pool {{ id: string; buckets: readonly BucketEntry[]; slots: readonly PoolSlot[] }} the
 *        pool on screen
 * @param initial {SlotValueMap} what the page read
 * @param settled {boolean} nothing is waiting to be saved
 * @param fetcher {Fetcher} fetch (tests)
 * @param retryMs {number} the first wait after a failed answer (tests shorten it)
 * @returns {SlotValueMap} every value known so far
 */
export const useSlotValues = (
  pool: { id: string; buckets: readonly BucketEntry[]; slots: readonly PoolSlot[] },
  initial: SlotValueMap,
  settled: boolean,
  fetcher: Fetcher = fetch,
  retryMs: number = VALUES_RETRY_MS,
): SlotValueMap => {
  const [values, setValues] = useState<SlotValueMap>(initial);
  const [asking, setAsking] = useState(false);
  const [failures, setFailures] = useState(0);
  const [waiting, setWaiting] = useState(false);
  const [stopped, setStopped] = useState(false);
  const asked = useRef(new Set<string>());
  const missing = pool.slots
    .map((slot) => slotValueKey(slot.beatmapId, builtSlotCode(slot, pool.buckets)))
    .filter((key) => !(key in values) && !asked.current.has(key))
    .join(",");
  useEffect(() => {
    if (missing === "" || !settled || asking || waiting || stopped) return;
    setAsking(true);
    void callPools<ValuesBody>(fetcher, `/api/pools/${pool.id}/values`).then((answer) => {
      if (answer.ok && answer.body?.values) {
        for (const key of missing.split(",")) asked.current.add(key);
        const found = answer.body.values;
        setValues((was) => ({ ...was, ...found }));
        setFailures(0);
      } else if (!answer.ok && FINAL.has(answer.status)) setStopped(true);
      else {
        setFailures((n) => n + 1);
        setWaiting(true);
      }
      setAsking(false);
    });
  }, [missing, settled, asking, waiting, stopped, pool.id, fetcher]);
  useEffect(() => {
    if (!waiting) return;
    const wait = Math.min(retryMs * 2 ** Math.max(failures - 1, 0), VALUES_RETRY_MAX_MS);
    const timer = setTimeout(() => setWaiting(false), wait);
    return () => clearTimeout(timer);
  }, [waiting, failures, retryMs]);
  return values;
};
