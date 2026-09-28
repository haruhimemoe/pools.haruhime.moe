/**
 * @file src/services/map-browse.ts
 * @desc One page of the map browser (GET /api/maps/browse). Ranked, Loved and Graveyard come
 *       from the mirror's mod data (src/lib/nekoha-search.ts, in the sort picked) under a lens
 *       the mirror offers
 *       (src/lib/browse-lenses.ts; any other reads as NM), one difficulty a row, grouped by set
 *       in page order. Qualified and Pending come from the all-maps search without mods
 *       (src/lib/map-search.ts), so modValuesAvailable is false. Sets are judged as all-maps
 *       judges them (judgeSets: disallowed ones hidden and counted, potential ones "Check
 *       first"). Stars come from the row; BPM and length from the mod math; AR, OD and CS from
 *       pp/batch under the lens (src/lib/mod-values.ts), else no-mod values and the math
 *       ("math"). Then the page's own filters: the pool's maps (excluded), BPM, length, AR and
 *       OD under the lens (filteredOnPage), and with hidePlayed, maps past pools played
 *       (playedHidden, from one maps lookup). A failed mirror search is a failure; a failed
 *       setFacts read, pp/batch call or maps lookup answers anyway, not to be cached.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

import "server-only";
import { isLeaderboardStatus, type OsuBeatmapset } from "@haruhimemoe/compliance";
import {
  BROWSE_PAGE_SIZE,
  type BrowseLens,
  DEFAULT_LENS,
  LENS_STATUSES,
  type LensStatus,
} from "@/constants/browse";
import { MAX_SEARCH_PAGE } from "@/constants/search";
import { availableLenses } from "@/lib/browse-lenses";
import { mirrorPageCount, searchMirror } from "@/lib/map-search";
import { getModValues } from "@/lib/mod-values";
import { searchNekoha } from "@/lib/nekoha-search";
import { countPlayed, judgeSets, type PlayedCounts, shownMaps } from "@/services/all-maps";
import type { BrowseParams, BrowseResponse, BrowseSet } from "@/utils/browse-params";
import {
  type BaseValues,
  type DiffValues,
  diffValues,
  passesPageFilters,
} from "@/utils/browse-values";
import { parseMods } from "@/utils/mod-values";

export type BrowseDeps = {
  fetch?: typeof fetch;
  timeoutMs?: number;
  now?: () => number;
  playedCounts?: PlayedCounts;
};

export type BrowseResult = { ok: true; answer: BrowseResponse; cacheable: boolean } | { ok: false };

type MirrorDeps = Pick<BrowseDeps, "fetch" | "timeoutMs" | "now">;

/** A difficulty as its page brought it: stars under the lens, BPM and length without mods. */
type PageDiff = {
  id: number;
  version: string;
  stars: number;
  starsNoMod: number;
  bpm: number;
  length: number;
  /** No-mod AR, OD and CS, when the row has them. */
  base: BaseValues | null;
};

type PageSet = { set: OsuBeatmapset & { creator: string }; diffs: PageDiff[] };
type Page = { sets: PageSet[]; total: number | null; pageCount: number | null };

const isLensStatus = (status: string): status is LensStatus =>
  (LENS_STATUSES as readonly string[]).includes(status);

/** The mirror's mod data: rows grouped by set in page order. */
const modDataPage = async (
  params: BrowseParams,
  status: LensStatus,
  lens: BrowseLens,
  deps: MirrorDeps,
): Promise<Page | null> => {
  const { q, sr, sort, page } = params;
  const found = await searchNekoha({ lens, status, q, sr, sort, page }, deps);
  if (!found.ok) {
    console.error(`[map-browse] the mirror's mod data search failed: ${found.reason}`);
    return null;
  }
  const bySet = new Map<number, PageSet>();
  for (const row of found.rows) {
    const { setId: id, status: setStatus, artist, title, creator } = row;
    const entry = bySet.get(id) ?? {
      set: { id, status: setStatus, artist, title, creator },
      diffs: [],
    };
    const { version, stars, starsNoMod, bpm, length } = row;
    entry.diffs.push({ id: row.id, version, stars, starsNoMod, bpm, length, base: null });
    bySet.set(id, entry);
  }
  const pageCount = Math.min(Math.ceil(found.total / BROWSE_PAGE_SIZE), MAX_SEARCH_PAGE);
  return { sets: [...bySet.values()], total: found.total, pageCount };
};

/** The all-maps search, without mods: a set's difficulties as all-maps shows them. */
const noModPage = async (params: BrowseParams, deps: MirrorDeps): Promise<Page | null> => {
  const { q, status, sr, len, bpm, explicit, page } = params;
  const found = await searchMirror({ q, status, sr, len, bpm, explicit }, page, deps);
  if (!found.ok) {
    console.error(`[map-browse] the all-maps search failed: ${found.reason}`);
    return null;
  }
  const sets = found.sets.flatMap((set) => {
    const diffs = shownMaps(set, sr).map((map): PageDiff => {
      const { id, version, stars, bpm: noModBpm, length, ar, od, cs } = map;
      const base = ar !== null && od !== null && cs !== null ? { ar, od, cs } : null;
      return { id, version, stars, starsNoMod: stars, bpm: noModBpm, length, base };
    });
    return diffs.length > 0 ? [{ set, diffs }] : [];
  });
  const pageCount = mirrorPageCount({ total: found.total, received: found.received, page });
  return { sets, total: found.total, pageCount };
};

/**
 * Values under the lens for each difficulty: pp/batch under the lens (a row's own no-mod values
 * serve for NM), then no-mod values from the row or pp/batch and the math.
 */
const valuesFor = async (
  diffs: readonly PageDiff[],
  lens: BrowseLens,
  deps: MirrorDeps,
): Promise<{ values: Map<number, DiffValues>; failed: boolean }> => {
  const mods = parseMods(lens) ?? [];
  const noMod = lens === DEFAULT_LENS;
  const asked = diffs.filter((diff) => !(noMod && diff.base)).map((diff) => diff.id);
  const underLens = await getModValues(asked, lens, deps);
  const bare = noMod
    ? []
    : diffs.filter((diff) => !diff.base && !underLens.values.has(diff.id)).map((diff) => diff.id);
  const bases = await getModValues(bare, DEFAULT_LENS, deps);
  const values = new Map<number, DiffValues>();
  for (const diff of diffs) {
    const own = noMod && diff.base ? { ...diff.base, stars: diff.stars, bpm: diff.bpm } : undefined;
    const base = diff.base ?? bases.values.get(diff.id) ?? null;
    values.set(diff.id, diffValues(diff, mods, own ?? underLens.values.get(diff.id), base));
  }
  return { values, failed: underLens.failed || bases.failed };
};

/** Current past pools per id, or null when the lookup failed. */
const playedIn = async (
  ids: readonly number[],
  playedCounts: PlayedCounts,
): Promise<Map<number, number> | null> => {
  try {
    return ids.length > 0 ? await playedCounts(ids) : new Map();
  } catch (error) {
    console.error("[map-browse] the played-in lookup failed", error);
    return null;
  }
};

/**
 * @function browseMaps
 * @param params {BrowseParams} the browse
 * @param deps {BrowseDeps} fetch, timeout, clock and the played counts (tests)
 * @returns {Promise<BrowseResult>} the page and whether it may be cached, or a failure when the
 *          mirror's search failed
 */
export const browseMaps = async (
  params: BrowseParams,
  { playedCounts = countPlayed, ...mirror }: BrowseDeps = {},
): Promise<BrowseResult> => {
  const lenses = await availableLenses(mirror);
  const { status } = params;
  const withMods = isLensStatus(status);
  const lens = withMods && lenses.includes(params.lens) ? params.lens : DEFAULT_LENS;
  const page = withMods
    ? await modDataPage(params, status, lens, mirror)
    : await noModPage(params, mirror);
  if (!page) return { ok: false };
  const judged = await judgeSets(
    page.sets.map((entry) => entry.set),
    (mirror.now ?? Date.now)(),
  );
  const allowed = page.sets.filter((entry) => judged.allowed.has(entry.set.id));
  const inPool = new Set(params.excludeIds);
  const kept = allowed.map((entry) => ({
    ...entry,
    diffs: entry.diffs.filter((diff) => !inPool.has(diff.id)),
  }));
  const valued = await valuesFor(
    kept.flatMap((entry) => entry.diffs),
    lens,
    mirror,
  );
  const shown = kept.map((entry) => ({
    ...entry,
    diffs: entry.diffs.filter((diff) => {
      const values = valued.values.get(diff.id);
      return values !== undefined && passesPageFilters(values, params);
    }),
  }));
  const counts = await playedIn(
    shown.flatMap((entry) => entry.diffs.map((diff) => diff.id)),
    playedCounts,
  );
  const count = (entries: readonly PageSet[]) =>
    entries.reduce((sum, entry) => sum + entry.diffs.length, 0);
  const sets: BrowseSet[] = [];
  let playedHidden = 0;
  for (const { set, diffs } of shown) {
    const out = diffs.flatMap((diff) => {
      const played = counts === null ? null : (counts.get(diff.id) ?? 0);
      if (params.hidePlayed && played !== null && played > 0) {
        playedHidden++;
        return [];
      }
      const values = valued.values.get(diff.id);
      if (!values) return [];
      const { id, version, stars, starsNoMod } = diff;
      return [{ id, version, stars, starsNoMod, ...values, playedIn: played }];
    });
    if (out.length === 0) continue;
    out.sort((a, b) => a.stars - b.stars || a.id - b.id);
    const { id: setId, artist, title, creator } = set;
    const check = judged.allowed.get(setId)?.check ?? null;
    const unranked = !isLeaderboardStatus(set.status);
    sets.push({ setId, artist, title, creator, status: set.status, unranked, check, diffs: out });
  }
  return {
    ok: true,
    cacheable: judged.ok && counts !== null && !valued.failed,
    answer: {
      lens,
      lenses: [...lenses],
      status,
      page: params.page,
      pageCount: page.pageCount,
      total: page.total,
      hidden: page.sets.length - allowed.length,
      filteredOnPage: count(kept) - count(shown),
      excluded: count(allowed) - count(kept),
      playedHidden,
      modValuesAvailable: withMods,
      sets,
    },
  };
};
