/**
 * @file src/services/your-candidates.ts
 * @desc "Your candidates": every candidate (and, when asked, every pick) from the pools the caller
 *       owns or edits, read live from built_pools (so a deleted pool's are gone at once),
 *       filtered, newest first, a page at a time, each with its map's details and its values
 *       under the mods of a bucket in the pool being edited. The caller must be able to edit that
 *       pool (it names the bucket); otherwise 404 or 403, as the pool routes answer. Never
 *       public.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import "server-only";
import { bucketsOf, findBucket } from "@haruhimemoe/pool";
import { QUERY_TIME_MS } from "@/constants/db";
import { builtPoolsCollection } from "@/models/BuiltPool";
import type { YourCandidatesAnswer, YourCandidatesQuery } from "@/schemas/your-candidates";
import { getBuiltMaps } from "@/services/built-pool-maps";
import { loadFor } from "@/services/built-pool-read";
import { builtSlotValues, type SlotValuesDeps } from "@/services/slot-values";
import type { Caller } from "@/utils/built-access";
import type { Answer } from "@/utils/built-answer";
import { builtSlotCode, slotValueKey } from "@/utils/slot-values";
import { entriesOf, filterEntries, type OwnPool, pageOf } from "@/utils/your-candidates";

/** The most pools one list reads (an owner's 50 and some they edit). */
const MAX_POOLS = 200;

const ownPools = async (caller: NonNullable<Caller>): Promise<OwnPool[]> => {
  const rows = await (await builtPoolsCollection())
    .find(
      { $or: [{ ownerId: caller.id }, { "editors.osuId": caller.osuId }] },
      {
        projection: { name: 1, slots: 1, slotNotes: 1, candidates: 1, updatedAt: 1 },
        maxTimeMS: QUERY_TIME_MS,
        limit: MAX_POOLS,
      },
    )
    .toArray();
  return rows as unknown as OwnPool[];
};

/**
 * @function listYourCandidates
 * @param caller {NonNullable<Caller>} who's asking (signed in)
 * @param query {YourCandidatesQuery} the pool being edited, the bucket, filters and page
 * @param deps {SlotValuesDeps} the mirror's fetch and deadline (tests)
 * @returns {Promise<Answer<YourCandidatesAnswer>>} a page of rows; 404 or 403 when the caller
 *          can't edit the pool named
 */
export const listYourCandidates = async (
  caller: NonNullable<Caller>,
  query: YourCandidatesQuery,
  deps: SlotValuesDeps = {},
): Promise<Answer<YourCandidatesAnswer>> => {
  const loaded = await loadFor(query.pool, caller, (access) => access.canEdit);
  if (!loaded.ok) return loaded;
  const buckets = bucketsOf(loaded.value.pool);
  const under = findBucket(buckets, query.under) ? query.under : "NM";
  const all = entriesOf(await ownPools(caller), query.picks);
  const details = await getBuiltMaps(all.map((entry) => entry.beatmapId));
  const maps = Object.fromEntries(details.map((map) => [map.id, map]));
  const { entries, total, pages } = pageOf(filterEntries(all, query, maps), query.page);
  const slots = entries.map((entry) => ({ mod: under, index: 1, beatmapId: entry.beatmapId }));
  const { values, complete } = await builtSlotValues({ buckets, slots }, maps, deps);
  const combo = builtSlotCode({ mod: under, index: 1, beatmapId: 0 }, buckets);
  const rows = entries.map((entry) => ({
    ...entry,
    beatmapsetId: entry.beatmapsetId ?? maps[entry.beatmapId]?.setId ?? null,
    map: maps[entry.beatmapId] ?? null,
    values: values[slotValueKey(entry.beatmapId, combo)] ?? null,
  }));
  return { ok: true, value: { rows, total, page: query.page, pages, under: combo, complete } };
};
