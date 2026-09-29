/**
 * @file src/utils/page-seo.ts
 * @desc Titles, descriptions, index rules and JSON-LD for pool and map pages. A past pool is
 *       "<name> mappool" with a Dataset and breadcrumbs (a superseded one isn't indexed); a map
 *       page gets one generated sentence (how often and how it was played, and where last), a
 *       CreativeWork naming the pools it was in, breadcrumbs, and is indexed only once
 *       MAP_INDEX_MIN_POOLS current pools use it (the sitemap follows the same rule). Pure.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { type LdGraph, ld } from "@haruhimemoe/next-kit/seo";
import { beatmapUrl } from "@haruhimemoe/osu/shapes";
import { MAP_INDEX_MIN_POOLS, SEO_SITE } from "@/constants/seo";
import type { StoredMap } from "@/schemas/map";
import type { StoredPool } from "@/schemas/pool";
import type { HistoryRow } from "@/utils/history";
import { mapLabel } from "@/utils/map-record";
import { poolHeadline } from "@/utils/pool-text";

/**
 * @function poolTitle
 * @param name {string} a pool's name
 * @returns {string} the name with "mappool" after it, unless it already says mappool
 */
export const poolTitle = (name: string): string =>
  /\bmappool\b/i.test(name) ? name : `${name} mappool`;

/**
 * @function poolDescription
 * @param pool {Pick<StoredPool, "tournament" | "round" | "year" | "slots">} a past pool
 * @returns {string} its headline, map count and what the page has
 */
export const poolDescription = (
  pool: Pick<StoredPool, "tournament" | "round" | "year" | "slots">,
): string =>
  `${poolHeadline(pool)}. ${pool.slots.length} ${pool.slots.length === 1 ? "map" : "maps"} with star ratings under each slot's mods, where each map was played before, and a pack to download them.`;

const sourceUrls = (pool: Pick<StoredPool, "sources">): string[] =>
  pool.sources.flatMap((source) =>
    source.kind === "otdb" ? [source.url] : source.credit.url ? [source.credit.url] : [],
  );

/**
 * @function poolLd
 * @param pool {StoredPool} a past pool
 * @returns {LdGraph} a Dataset (tournament as creator, year as coverage, its sources' links as
 *          isBasedOn) and the breadcrumbs home › pool
 */
export const poolLd = (pool: StoredPool): LdGraph => {
  const path = `/pools/${pool._id}`;
  const based = sourceUrls(pool);
  return ld.graph(
    ld.dataset(SEO_SITE, {
      path,
      name: poolTitle(pool.name),
      description: poolDescription(pool),
      creator: pool.tournament,
      ...(pool.year === null ? {} : { temporalCoverage: String(pool.year) }),
      ...(based.length > 0 ? { isBasedOn: based } : {}),
      dateModified: pool.updatedAt,
    }),
    ld.breadcrumbs(SEO_SITE, [
      { name: SEO_SITE.name, path: "/" },
      { name: pool.name, path },
    ]),
  );
};

/**
 * @function isMapIndexed
 * @param usage {{ count: number }} a map's usage
 * @returns {boolean} whether its page is indexed and in the sitemap (used in 2 or more pools)
 */
export const isMapIndexed = (usage: { count: number }): boolean =>
  usage.count >= MAP_INDEX_MIN_POOLS;

const list = (items: readonly string[]): string =>
  items.length < 2 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;

const where = (row: HistoryRow): string =>
  [row.tournament, row.round, row.year === null ? null : `(${row.year})`].filter(Boolean).join(" ");

/**
 * @function mapSentence
 * @param map {Pick<StoredMap, "_id" | "artist" | "title" | "version" | "setHost" | "usage">}
 *        a map
 * @param history {readonly HistoryRow[]} the current pools it's in, newest first
 * @returns {string} "<label>, from <host>'s set, has been played in N osu! tournament pools, as
 *          NM and HR, most recently in <tournament round (year)>."
 */
export const mapSentence = (
  map: Pick<StoredMap, "_id" | "artist" | "title" | "version" | "setHost" | "usage">,
  history: readonly HistoryRow[],
): string => {
  const label = mapLabel(map, map._id);
  const { count, playedAs } = map.usage;
  if (count === 0) return `${label} isn't in any current osu! tournament pool.`;
  const host = map.setHost ? `, from ${map.setHost}'s set,` : "";
  const as = playedAs.length > 0 ? `, as ${list(playedAs)}` : "";
  const latest = history[0];
  const recent = latest ? `, most recently in ${where(latest)}` : "";
  return `${label}${host} has been played in ${count} osu! tournament ${count === 1 ? "pool" : "pools"}${as}${recent}.`;
};

/**
 * @function mapLd
 * @param map {StoredMap} a map
 * @param history {readonly HistoryRow[]} the current pools it's in
 * @param description {string} the page's description
 * @returns {LdGraph} a CreativeWork (the beatmap: set host as author, the osu! page as
 *          isBasedOn, the pools it's in as an ItemList) and the breadcrumbs home › map
 */
export const mapLd = (
  map: StoredMap,
  history: readonly HistoryRow[],
  description: string,
): LdGraph => {
  const path = `/maps/${map._id}`;
  const label = mapLabel(map, map._id);
  const pools = [...new Map(history.map((row) => [row.poolId, row])).values()];
  return ld.graph(
    {
      ...ld.creativeWork(SEO_SITE, {
        path,
        name: label,
        description,
        ...(map.setHost ? { author: map.setHost } : {}),
        isBasedOn: beatmapUrl(map._id),
        genre: "osu! beatmap",
      }),
      subjectOf: ld.itemList(
        SEO_SITE,
        pools.map((row) => ({ name: where(row), path: `/pools/${row.poolId}` })),
        { name: "osu! tournament pools with this map" },
      ),
    },
    ld.breadcrumbs(SEO_SITE, [
      { name: SEO_SITE.name, path: "/" },
      { name: label, path },
    ]),
  );
};
