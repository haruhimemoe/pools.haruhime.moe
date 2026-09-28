/**
 * @file src/services/map-fill.ts
 * @desc Fills maps from the mirror: every map still holding only otdb's details or none (a map
 *       an admin added), or only the ids given (an added pool's), 100 ids a call, one call at a
 *       time. Found maps take the mirror's
 *       values (no-mod stars among them); maps the mirror doesn't have keep otdb's and are asked
 *       for again next run. A retryable mirror error waits (its Retry-After, else 1 s, 2 s) and
 *       tries the batch again, 3 tries in all; any other mirror error stops the fill and the
 *       result says why. Mirror errors never throw.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Mon Sep 28, 2026
 */

import "server-only";
import { backoffDelayMs, HINAI_BATCH_LIMIT, HinaiError } from "@haruhimemoe/hinai";
import type { BeatmapMeta } from "@haruhimemoe/osu/shapes";
import type { AnyBulkWriteOperation } from "mongodb";
import { BATCH_QUERY_MS } from "@/constants/db";
import { getHinaiClient } from "@/lib/hinai";
import { mapsCollection } from "@/models/Map";
import { type StoredMap, UNFILLED_META_SOURCES } from "@/schemas/map";
import { mirrorFields } from "@/utils/map-record";

/** Asks the mirror about some maps (the hinai client's getBeatmaps). */
export type MapLookup = (
  ids: readonly number[],
) => Promise<{ found: Map<number, BeatmapMeta>; missing: number[] }>;

/** What a fill did: ids asked, rows filled, ids missing, and why it stopped. */
export type FillResult = { asked: number; filled: number; missing: number; error: string | null };

const MAX_TRIES = 3;

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const lookupWithRetries = async (
  batch: readonly number[],
  lookup: MapLookup,
  sleep: (ms: number) => Promise<void>,
): ReturnType<MapLookup> => {
  for (let attempt = 1; ; attempt++) {
    try {
      return await lookup(batch);
    } catch (error) {
      if (!(error instanceof HinaiError) || !error.retryable || attempt >= MAX_TRIES) throw error;
      await sleep(backoffDelayMs(attempt, error.retryAfterMs));
    }
  }
};

/**
 * @function fillMaps
 * @param deps {{ ids?: readonly number[]; lookup?: MapLookup; now?: () => Date; sleep?: (ms:
 *        number) => Promise<void> }} only these maps (default: every unfilled one), the mirror
 *        lookup, clock and wait (tests)
 * @returns {Promise<FillResult>} ids asked, rows filled, ids the mirror doesn't have, and why it
 *          stopped early (null when it didn't)
 */
export const fillMaps = async ({
  ids: only,
  lookup = (ids) => getHinaiClient().getBeatmaps(ids),
  now = () => new Date(),
  sleep = wait,
}: {
  ids?: readonly number[];
  lookup?: MapLookup;
  now?: () => Date;
  sleep?: (ms: number) => Promise<void>;
} = {}): Promise<FillResult> => {
  const maps = await mapsCollection();
  const ids = (
    await maps
      .find(
        {
          metaSource: { $in: [...UNFILLED_META_SOURCES] },
          ...(only ? { _id: { $in: [...only] } } : {}),
        },
        { projection: { _id: 1 }, sort: { _id: 1 }, maxTimeMS: BATCH_QUERY_MS },
      )
      .toArray()
  ).map((map) => map._id);
  const result: FillResult = { asked: 0, filled: 0, missing: 0, error: null };
  for (let start = 0; start < ids.length; start += HINAI_BATCH_LIMIT) {
    const batch = ids.slice(start, start + HINAI_BATCH_LIMIT);
    let answer: Awaited<ReturnType<MapLookup>>;
    try {
      answer = await lookupWithRetries(batch, lookup, sleep);
    } catch (error) {
      return { ...result, error: `The mirror stopped the map fill: ${messageOf(error)}` };
    }
    result.asked += batch.length;
    const at = now();
    const ops: AnyBulkWriteOperation<StoredMap>[] = [...answer.found].map(([id, meta]) => ({
      updateOne: { filter: { _id: id }, update: { $set: mirrorFields(meta, at) } },
    }));
    if (ops.length > 0) await maps.bulkWrite(ops, { ordered: false });
    result.filled += ops.length;
    result.missing += answer.missing.length;
  }
  return result;
};
