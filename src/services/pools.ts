/**
 * @file src/services/pools.ts
 * @desc Pool reads for pages: one pool by id (admins see hidden ones; public reads never do),
 *       the maps a pool page shows, the home page's counts (current pools, used maps, sources)
 *       and Recently added (the 8 visible pools added last), and every current pool for the
 *       sitemap and llms.txt. Every read has maxTimeMS; list
 *       reads hint their index. The home, sitemap and llms.txt reads come back empty under
 *       SKIP_ENV_VALIDATION (the CI build, with no database); at runtime a database error goes
 *       through, so ISR keeps serving the last good version instead of storing an empty one.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Mon Sep 28, 2026
 */

import "server-only";
import { isEnvValidationSkipped } from "@haruhimemoe/next-kit/env";
import { MAP_INDEXES, POOL_INDEXES, QUERY_TIME_MS } from "@/constants/db";
import { POOL_ID_PATTERN, SOURCE_KINDS, type SourceKind } from "@/constants/pools";
import { mapsCollection } from "@/models/Map";
import { poolsCollection } from "@/models/Pool";
import type { StoredMap } from "@/schemas/map";
import { parseStoredPool, type StoredPool } from "@/schemas/pool";
import { countMatching } from "@/services/count";
import type { LlmsPool } from "@/utils/llms-txt";

/**
 * @function getPoolById
 * @param id {string} an untrusted pool id
 * @returns {Promise<StoredPool | null>} the pool, hidden or not, or null
 */
export const getPoolById = async (id: string): Promise<StoredPool | null> => {
  if (!POOL_ID_PATTERN.test(id)) return null;
  const pools = await poolsCollection();
  return parseStoredPool(await pools.findOne({ _id: id }, { maxTimeMS: QUERY_TIME_MS }));
};

/**
 * @function getPublicPool
 * @param id {string} an untrusted pool id
 * @returns {Promise<StoredPool | null>} the pool unless it's hidden (superseded pools keep
 *          their page)
 */
export const getPublicPool = async (id: string): Promise<StoredPool | null> => {
  const pool = await getPoolById(id);
  return pool && !pool.hidden ? pool : null;
};

/** What a pool page shows for each map. */
export type MapSummary = Pick<
  StoredMap,
  "_id" | "setId" | "artist" | "title" | "version" | "stars" | "length" | "bpm" | "ar" | "od" | "cs"
>;

/**
 * @function getMapSummaries
 * @param ids {readonly number[]} a pool's beatmap ids
 * @returns {Promise<Map<number, MapSummary>>} the ones we have, by id
 */
export const getMapSummaries = async (ids: readonly number[]): Promise<Map<number, MapSummary>> => {
  const maps = await mapsCollection();
  const rows = await maps
    .find(
      { _id: { $in: [...new Set(ids)] } },
      {
        projection: {
          setId: 1,
          artist: 1,
          title: 1,
          version: 1,
          stars: 1,
          length: 1,
          bpm: 1,
          ar: 1,
          od: 1,
          cs: 1,
        },
        maxTimeMS: QUERY_TIME_MS,
      },
    )
    .toArray();
  return new Map(rows.map((row) => [row._id, row as MapSummary]));
};

/** The home page's counts and the kinds of source there are. */
export type HomeCounts = { pools: number; maps: number; sources: SourceKind[] };

const NO_COUNTS: HomeCounts = { pools: 0, maps: 0, sources: [] };

/**
 * @function loadHomeCounts
 * @returns {Promise<HomeCounts>} current pools, maps some current pool uses, and the sources
 *          current pools came from; zeros under SKIP_ENV_VALIDATION
 * @throws {Error} on a database error (ISR keeps the last good page)
 */
export const loadHomeCounts = async (): Promise<HomeCounts> => {
  if (isEnvValidationSkipped()) return NO_COUNTS;
  const pools = await poolsCollection();
  const maps = await mapsCollection();
  const [poolCount, mapCount, kinds] = await Promise.all([
    countMatching(pools, { visible: true }, { hint: POOL_INDEXES.year, maxTimeMS: QUERY_TIME_MS }),
    countMatching(
      maps,
      { "usage.count": { $gte: 1 } },
      { hint: MAP_INDEXES.used, maxTimeMS: QUERY_TIME_MS },
    ),
    pools.distinct("sources.kind", { visible: true }, { maxTimeMS: QUERY_TIME_MS }),
  ]);
  return {
    pools: poolCount,
    maps: mapCount,
    sources: SOURCE_KINDS.filter((kind) => (kinds as unknown[]).includes(kind)),
  };
};

/** The home page's Recently added: this many pools. */
export const RECENT_POOLS = 8;

/** A pool as Recently added lists it. */
export type RecentPool = Pick<
  StoredPool,
  "_id" | "name" | "tournament" | "round" | "year" | "createdAt"
>;

/**
 * @function listRecentPools
 * @returns {Promise<RecentPool[]>} the 8 visible pools added last, newest first (on the
 *          visible_1_createdAt_-1__id_1 index); empty under SKIP_ENV_VALIDATION
 * @throws {Error} on a database error (ISR keeps the last good page)
 */
export const listRecentPools = async (): Promise<RecentPool[]> => {
  if (isEnvValidationSkipped()) return [];
  const pools = await poolsCollection();
  const rows = await pools
    .find(
      { visible: true },
      {
        projection: { name: 1, tournament: 1, round: 1, year: 1, createdAt: 1 },
        sort: { createdAt: -1, _id: 1 },
        limit: RECENT_POOLS,
        hint: POOL_INDEXES.recent,
        maxTimeMS: QUERY_TIME_MS,
      },
    )
    .toArray();
  return rows as RecentPool[];
};

/**
 * @function listCurrentPools
 * @returns {Promise<(LlmsPool & { updatedAt: Date })[]>} every current pool, newest year first;
 *          empty under SKIP_ENV_VALIDATION
 * @throws {Error} on a database error (ISR keeps the last good sitemap and llms.txt)
 */
export const listCurrentPools = async (): Promise<(LlmsPool & { updatedAt: Date })[]> => {
  if (isEnvValidationSkipped()) return [];
  const pools = await poolsCollection();
  return pools
    .find(
      { visible: true },
      {
        projection: { name: 1, tournament: 1, round: 1, year: 1, updatedAt: 1 },
        sort: { year: -1, _id: 1 },
        hint: POOL_INDEXES.year,
        maxTimeMS: QUERY_TIME_MS,
      },
    )
    .toArray();
};
