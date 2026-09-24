/**
 * @file src/services/compliance.ts
 * @desc The check: for each beatmap id its beatmapset's compliance facts, from the setFacts cache
 *       when fresh (under a day; found by the difficulty ids stored on each set, or by the set id
 *       pools' own maps know), else from osu! (getBeatmapsets, 50 ids a call, under the global
 *       budget and the caller's share), cached per set; then one @haruhimemoe/compliance verdict
 *       per set, with its wording. Ids osu! doesn't know are missing; ids it couldn't answer
 *       (budget spent, an error) are unchecked, never guessed. Without a database nothing is
 *       checked: osu! is never called without a budget. Also what pools knows about each map
 *       (label and usage from current pools), for the rows.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import "server-only";
import {
  type BeatmapsetFacts,
  evaluateBeatmapset,
  factsFromOsuBeatmapset,
  isLeaderboardStatus,
  verdictText,
} from "@haruhimemoe/compliance";
import type { Db } from "mongodb";
import { FACTS_FALLBACK_LIMIT, SET_FACTS_TTL_SECONDS } from "@/constants/compliance";
import { MAPS_COLLECTION, QUERY_TIME_MS, SET_FACTS_COLLECTION } from "@/constants/db";
import { connectedDb } from "@/lib/db";
import { getOsuClient, type OsuClient } from "@/lib/osu";
import { budgetGate } from "@/lib/osu-budget";
import { mapsCollection } from "@/models/Map";
import {
  type CheckMap,
  type ComplianceSet,
  type SetFactsDoc,
  setFactsDocSchema,
} from "@/schemas/compliance";
import type { StoredMap } from "@/schemas/map";
import { mapLabel } from "@/utils/map-record";

type Facts = BeatmapsetFacts & { setId: number };

type Deps = {
  osu?: Pick<OsuClient, "getBeatmapsets">;
  db?: () => Promise<Db>;
  now?: () => number;
  /** The caller's IP subject; omitted, only the global budget counts. */
  subject?: string;
};

const factsOf = (doc: SetFactsDoc): Facts => ({
  setId: doc._id,
  status: doc.status,
  artist: doc.artist,
  title: doc.title,
  artistUnicode: doc.artistUnicode,
  titleUnicode: doc.titleUnicode,
  source: doc.source,
  tags: doc.tags,
  trackId: doc.trackId,
  downloadDisabled: doc.downloadDisabled,
  moreInformation: doc.moreInformation,
});

const ascending = (a: number, b: number): number => a - b;

/** Reads fresh cached facts for the ids it can; logs and skips a cache that fails. */
const readCache = async (
  database: Db,
  ids: readonly number[],
  fresh: Date,
): Promise<Map<number, Facts>> => {
  const found = new Map<number, Facts>();
  try {
    const cache = database.collection(SET_FACTS_COLLECTION);
    const valid = (rows: unknown[]) =>
      rows.flatMap((row) => {
        const parsed = setFactsDocSchema.safeParse(row);
        return parsed.success ? [parsed.data] : [];
      });
    for (const doc of valid(
      await cache
        .find(
          { beatmapIds: { $in: [...ids] }, fetchedAt: { $gt: fresh } },
          { maxTimeMS: QUERY_TIME_MS },
        )
        .toArray(),
    )) {
      for (const id of doc.beatmapIds) if (ids.includes(id)) found.set(id, factsOf(doc));
    }
    const rest = ids.filter((id) => !found.has(id));
    if (rest.length === 0) return found;
    const known = await database
      .collection<StoredMap>(MAPS_COLLECTION)
      .find(
        { _id: { $in: rest }, setId: { $ne: null } },
        { projection: { setId: 1 }, maxTimeMS: QUERY_TIME_MS },
      )
      .toArray();
    const setIds = [...new Set(known.flatMap((map) => (map.setId === null ? [] : [map.setId])))];
    if (setIds.length === 0) return found;
    const sets = new Map(
      valid(
        await cache
          .find({ _id: { $in: setIds }, fetchedAt: { $gt: fresh } } as never, {
            maxTimeMS: QUERY_TIME_MS,
          })
          .toArray(),
      ).map((doc) => [doc._id, doc]),
    );
    for (const map of known) {
      const doc = map.setId === null ? undefined : sets.get(map.setId);
      if (doc) found.set(map._id, factsOf(doc));
    }
  } catch (error) {
    console.error("[check] couldn't read the cache", error);
  }
  return found;
};

/**
 * @function checkCompliance
 * @param ids {readonly number[]} beatmap ids (any order, repeats allowed)
 * @param deps {Deps} osu! client, database, clock and the caller's subject (tests)
 * @returns {Promise<{ sets: ComplianceSet[]; missing: number[]; unchecked: number[] }>} one
 *          verdict per set (by set id), and the ids with none, ascending. Never rejects.
 */
export const checkCompliance = async (
  ids: readonly number[],
  { osu = getOsuClient(), db = connectedDb, now = Date.now, subject }: Deps = {},
): Promise<{ sets: ComplianceSet[]; missing: number[]; unchecked: number[] }> => {
  const wanted = [...new Set(ids)].sort(ascending);
  let database: Db;
  try {
    database = await db();
  } catch (error) {
    console.error("[check] database unavailable", error);
    return { sets: [], missing: [], unchecked: wanted };
  }
  const facts = await readCache(database, wanted, new Date(now() - SET_FACTS_TTL_SECONDS * 1000));
  const uncached = wanted.filter((id) => !facts.has(id));
  const missing: number[] = [];
  const unchecked = new Set<number>();
  if (uncached.length > 0) {
    try {
      const lookup = await osu.getBeatmapsets(uncached, {
        beforeCall: budgetGate(database, subject, now),
        fallbackLimit: FACTS_FALLBACK_LIMIT,
      });
      const writes = new Map<number, { facts: BeatmapsetFacts; ids: number[] }>();
      for (const [beatmapId, set] of lookup.sets) {
        const setFacts = factsFromOsuBeatmapset(set);
        if (!setFacts) {
          unchecked.add(beatmapId);
          continue;
        }
        facts.set(beatmapId, { ...setFacts, setId: set.id });
        const entry = writes.get(set.id) ?? { facts: setFacts, ids: [] };
        entry.ids.push(beatmapId);
        writes.set(set.id, entry);
      }
      for (const id of lookup.unchecked) unchecked.add(id);
      for (const id of uncached) if (!facts.has(id) && !unchecked.has(id)) missing.push(id);
      const cache = database.collection(SET_FACTS_COLLECTION);
      await Promise.all(
        [...writes].map(([setId, { facts: setFacts, ids: seen }]) => {
          const { setId: _ignored, ...fields } = setFacts;
          return cache
            .updateOne(
              { _id: setId } as never,
              {
                $set: { ...fields, fetchedAt: new Date(now()) },
                $addToSet: { beatmapIds: { $each: seen } },
              },
              { upsert: true },
            )
            .catch((error: unknown) => console.error("[check] couldn't write the cache", error));
        }),
      );
    } catch (error) {
      console.error("[check] osu! lookup failed", error);
      for (const id of uncached) if (!facts.has(id)) unchecked.add(id);
    }
  }
  const bySet = new Map<number, { facts: Facts; ids: number[] }>();
  for (const [id, setFacts] of facts) {
    const entry = bySet.get(setFacts.setId) ?? { facts: setFacts, ids: [] };
    entry.ids.push(id);
    bySet.set(setFacts.setId, entry);
  }
  const sets = [...bySet]
    .sort(([a], [b]) => ascending(a, b))
    .map(([setId, { facts: setFacts, ids: members }]): ComplianceSet => {
      const verdict = evaluateBeatmapset(setFacts);
      return {
        setId,
        beatmapIds: members.sort(ascending),
        status: verdict.status,
        ...(verdict.reason ? { reason: verdict.reason } : {}),
        ...(verdict.notes ? { notes: verdict.notes } : {}),
        text: verdictText(verdict),
        ranked: isLeaderboardStatus(setFacts.status),
      };
    });
  return { sets, missing: missing.sort(ascending), unchecked: [...unchecked].sort(ascending) };
};

/**
 * @function checkMaps
 * @param ids {readonly number[]} beatmap ids
 * @returns {Promise<Record<string, CheckMap>>} for each id pools has: its label when a pool that
 *          isn't hidden has it, and its usage (current pools only); empty on a database error
 */
export const checkMaps = async (ids: readonly number[]): Promise<Record<string, CheckMap>> => {
  try {
    const maps = await mapsCollection();
    const rows = await maps
      .find(
        { _id: { $in: [...ids] } },
        { projection: { artist: 1, title: 1, version: 1, usage: 1 }, maxTimeMS: QUERY_TIME_MS },
      )
      .toArray();
    return Object.fromEntries(
      rows.map((row) => [
        String(row._id),
        {
          label: row.usage.shown ? mapLabel(row, row._id) : null,
          count: row.usage.count,
          lastYear: row.usage.lastYear,
        },
      ]),
    );
  } catch (error) {
    console.error("[check] couldn't read maps", error);
    return {};
  }
};
