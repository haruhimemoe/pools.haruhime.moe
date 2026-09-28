/**
 * @file src/services/all-maps.ts
 * @desc One page of every osu! map (src/lib/map-search.ts), judged and annotated. Each set goes
 *       through @haruhimemoe/compliance: facts from the mirror's set, or for a set too compact to
 *       judge, from a fresh setFacts row (one query by set id per page); else a Ranked,
 *       Approved or Loved set is judged with no takedown notice (the mirror's own pages carry
 *       none, so only "Check a pool" can see one) and any other shows as potential. Disallowed sets are left out and counted; potential ones say why to check
 *       first; graveyard, pending and WIP sets are tagged unranked. Only osu!standard
 *       difficulties show, and with a star range only the ones inside it (all when none are:
 *       the mirror's ratings differ slightly from osu!'s). Each difficulty says how many current
 *       pools played it, from one maps lookup; when that fails it says null and the answer
 *       isn't cached. Never calls the osu! API. The map browser (src/services/map-browse.ts)
 *       judges its sets (judgeSets), picks difficulties (shownMaps) and counts plays
 *       (countPlayed) the same way.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sat Sep 26, 2026
 * @modified Sun Sep 27, 2026
 */

import "server-only";
import {
  type BeatmapsetFacts,
  evaluateBeatmapset,
  factsFromOsuBeatmapset,
  isLeaderboardStatus,
  type OsuBeatmapset,
  verdictText,
} from "@haruhimemoe/compliance";
import { SET_FACTS_TTL_SECONDS } from "@/constants/compliance";
import { QUERY_TIME_MS, SET_FACTS_COLLECTION } from "@/constants/db";
import { connectDb, getDb } from "@/lib/db";
import { type MirrorSet, mirrorPageCount, searchMirror } from "@/lib/map-search";
import { mapsCollection } from "@/models/Map";
import { setFactsDocSchema } from "@/schemas/compliance";
import type { AllMapSet, SearchResponse } from "@/schemas/search-response";
import { factsOf } from "@/services/compliance";
import type { AllMapFilters, Range } from "@/utils/search-filters";

export type AllMapsAnswer = Omit<Extract<SearchResponse, { scope: "all" }>, "tab" | "scope">;

export type AllMapsResult = { ok: true; answer: AllMapsAnswer; cacheable: boolean } | { ok: false };

/** Current pools per beatmap id (0 for a map no pool has). */
export type PlayedCounts = (ids: readonly number[]) => Promise<Map<number, number>>;

export type AllMapsDeps = {
  fetch?: typeof fetch;
  timeoutMs?: number;
  playedCounts?: PlayedCounts;
  now?: () => number;
};

/**
 * @function countPlayed
 * @param ids {readonly number[]} beatmap ids
 * @returns {Promise<Map<number, number>>} current pools per id, for ids the maps collection has
 */
export const countPlayed: PlayedCounts = async (ids) => {
  const maps = await mapsCollection();
  const rows = await maps
    .find(
      { _id: { $in: [...ids] } },
      { projection: { "usage.count": 1 }, maxTimeMS: QUERY_TIME_MS },
    )
    .toArray();
  return new Map(rows.map((row) => [row._id, row.usage.count]));
};

/** Fresh cached facts for the sets the mirror sent too compact to judge; none when it fails. */
const cachedFacts = async (
  setIds: readonly number[],
  fresh: Date,
): Promise<{ facts: Map<number, BeatmapsetFacts>; ok: boolean }> => {
  const facts = new Map<number, BeatmapsetFacts>();
  if (setIds.length === 0) return { facts, ok: true };
  try {
    await connectDb();
    const rows = await getDb()
      .collection(SET_FACTS_COLLECTION)
      .find({ _id: { $in: [...setIds] }, fetchedAt: { $gt: fresh } } as never, {
        maxTimeMS: QUERY_TIME_MS,
      })
      .toArray();
    for (const row of rows) {
      const parsed = setFactsDocSchema.safeParse(row);
      if (parsed.success) facts.set(parsed.data._id, factsOf(parsed.data));
    }
    return { facts, ok: true };
  } catch (error) {
    console.error("[all-maps] couldn't read setFacts", error);
    return { facts, ok: false };
  }
};

/**
 * Facts for a compact Ranked, Approved or Loved set (the mirror's own pages send these without
 * availability or track_id): no takedown notice we can see, so the overrides rule still applies
 * and rule 4 passes it. Any other compact set has none and stays potential.
 */
const leaderboardFacts = (set: OsuBeatmapset): BeatmapsetFacts | null =>
  isLeaderboardStatus(set.status)
    ? {
        setId: set.id,
        status: set.status,
        artist: set.artist,
        title: set.title,
        artistUnicode: set.artist_unicode ?? set.artist,
        titleUnicode: set.title_unicode ?? set.title,
        source: set.source ?? "",
        tags: set.tags ?? "",
        trackId: null,
        downloadDisabled: false,
        moreInformation: null,
      }
    : null;

/**
 * @function shownMaps
 * @param set {MirrorSet} a set from the mirror's search
 * @param sr {Range | null} the star range
 * @returns {MirrorSet["beatmaps"]} its difficulties by stars: those inside the range when any
 *          are, else all
 */
export const shownMaps = (set: MirrorSet, sr: Range | null): MirrorSet["beatmaps"] => {
  const sorted = [...set.beatmaps].sort((a, b) => a.stars - b.stars || a.id - b.id);
  if (!sr) return sorted;
  const [low, high] = sr;
  const inside = sorted.filter((map) => map.stars >= low && (high === null || map.stars <= high));
  return inside.length > 0 ? inside : sorted;
};

/**
 * @function searchAllMaps
 * @param filters {AllMapFilters} the search
 * @param page {number} the page, from 1
 * @param deps {AllMapsDeps} fetch, timeout, the played counts and clock (tests)
 * @returns {Promise<AllMapsResult>} the page (hidden sets counted), whether it may be cached,
 *          or a failure when the mirror failed
 */
/** A set's verdict text: null when nothing stands in its way, else why to check first. */
export type SetJudgement = { check: { text: string } | null };

/**
 * @function judgeSets
 * @param sets {readonly OsuBeatmapset[]} sets as the mirror sent them (compact or not)
 * @param now {number} ms since the epoch
 * @returns {Promise<{ allowed: Map<number, SetJudgement>; ok: boolean }>} each allowed set's
 *          check text by set id (disallowed sets are left out); ok false when the setFacts read
 *          failed (the answer shouldn't be cached). Facts from the set itself, else a fresh
 *          setFacts row, else a Ranked, Approved or Loved set with no takedown notice; any
 *          other set is potential.
 */
export const judgeSets = async (
  sets: readonly OsuBeatmapset[],
  now: number,
): Promise<{ allowed: Map<number, SetJudgement>; ok: boolean }> => {
  const own = new Map(sets.map((set) => [set.id, factsFromOsuBeatmapset(set)]));
  const compact = sets.flatMap((set) => (own.get(set.id) ? [] : [set.id]));
  const cached = await cachedFacts(compact, new Date(now - SET_FACTS_TTL_SECONDS * 1000));
  const allowed = new Map<number, SetJudgement>();
  for (const set of sets) {
    const facts = own.get(set.id) ?? cached.facts.get(set.id) ?? leaderboardFacts(set);
    const verdict = facts ? evaluateBeatmapset(facts) : { status: "potential" as const };
    if (verdict.status === "disallowed") continue;
    allowed.set(set.id, {
      check: verdict.status === "potential" ? { text: verdictText(verdict) } : null,
    });
  }
  return { allowed, ok: cached.ok };
};

export const searchAllMaps = async (
  filters: AllMapFilters,
  page: number,
  { fetch, timeoutMs, playedCounts = countPlayed, now = Date.now }: AllMapsDeps = {},
): Promise<AllMapsResult> => {
  const found = await searchMirror(filters, page, {
    ...(fetch ? { fetch } : {}),
    ...(timeoutMs === undefined ? {} : { timeoutMs }),
  });
  if (!found.ok) {
    console.error(`[all-maps] the mirror search failed: ${found.reason}`);
    return { ok: false };
  }
  const sets = found.sets.filter((set) => set.beatmaps.length > 0);
  const judged = await judgeSets(sets, now());
  const results: AllMapSet[] = [];
  for (const set of sets) {
    const judgement = judged.allowed.get(set.id);
    if (!judgement) continue;
    results.push({
      setId: set.id,
      artist: set.artist,
      title: set.title,
      creator: set.creator,
      status: set.status,
      unranked: !isLeaderboardStatus(set.status),
      check: judgement.check,
      maps: shownMaps(set, filters.sr).map(({ id, version, stars, length, bpm }) => ({
        id,
        version,
        stars,
        length,
        bpm,
        playedIn: null,
      })),
    });
  }
  const hidden = sets.length - results.length;
  let counted = true;
  try {
    const ids = results.flatMap((set) => set.maps.map((map) => map.id));
    const counts = ids.length > 0 ? await playedCounts(ids) : new Map<number, number>();
    for (const set of results) {
      for (const map of set.maps) map.playedIn = counts.get(map.id) ?? 0;
    }
  } catch (error) {
    console.error("[all-maps] the played-in lookup failed", error);
    counted = false;
  }
  return {
    ok: true,
    cacheable: counted && judged.ok,
    answer: {
      page,
      pageCount: mirrorPageCount({ total: found.total, received: found.received, page }),
      total: found.total,
      hidden,
      results,
    },
  };
};
