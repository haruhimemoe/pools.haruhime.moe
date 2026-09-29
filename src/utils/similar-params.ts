/**
 * @file src/utils/similar-params.ts
 * @desc GET /api/maps/<id>/similar: its path id and query (`mods`, the lens, NM unless the
 *       browser offers it; `sr`, a star range under it; `pool`, a built pool whose maps to leave
 *       out), the URL the browser asks, and the answer's shape: sets as the map browser shows
 *       them, each difficulty with its similarity (0..100), how they were found, and what the
 *       filters left out. Pure, and safe in the browser.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { beatmapIdSchema } from "@haruhimemoe/pool";
import type { BrowseLens } from "@/constants/browse";
import { BUILT_POOL_ID_PATTERN } from "@/constants/built-pools";
import { STAR_RANGE } from "@/constants/search";
import type { SimilarMethod } from "@/constants/similar";
import type { BucketTargets } from "@/schemas/built-plan";
import { type BrowseDiff, type BrowseSet, parseLens } from "@/utils/browse-params";
import type { Range } from "@/utils/search-filters";
import { parseRange, rangeText } from "@/utils/search-ranges";

/** A similar-maps question: the lens, the star range under it, and the pool to leave out. */
export type SimilarQuery = { lens: BrowseLens; sr: Range | null; pool: string | null };

/** The map a "Find similar" press asks about: its id and "Artist - Title [Difficulty]". */
export type SimilarTarget = { id: number; label: string };

/** Opens the map browser's "Similar to" source (the editor wires it). */
export type FindSimilar = (target: SimilarTarget) => void;

/** A difficulty with how close it is (0..100). */
export type SimilarDiff = BrowseDiff & { similarity: number };

/** A set with its similar difficulties, closest first. */
export type SimilarSet = Omit<BrowseSet, "diffs"> & { diffs: SimilarDiff[] };

/** The map the others are like, when the mirror has it. */
export type SimilarSource = { setId: number; artist: string; title: string; version: string };

/** What GET /api/maps/<id>/similar answers. */
export type SimilarResponse = {
  id: number;
  source: SimilarSource | null;
  method: SimilarMethod;
  /** BoBERT's revision for a pattern match; null for a difficulty match. */
  rev: string | null;
  lens: BrowseLens;
  /** Difficulties left out as not allowed in officially supported tournaments. */
  hidden: number;
  /** Difficulties left out as already in the pool. */
  excluded: number;
  /** Difficulties outside the star range. */
  filtered: number;
  /** Neighbors the mirror doesn't have, or that aren't osu!standard. */
  missing: number;
  /** Sets in order of their closest difficulty. */
  sets: SimilarSet[];
};

/**
 * @function parseSimilarId
 * @param raw {string} the path's id
 * @returns {number | null} a beatmap id, or null
 */
export const parseSimilarId = (raw: string): number | null => {
  if (!/^\d{1,10}$/.test(raw)) return null;
  const id = Number(raw);
  return beatmapIdSchema.safeParse(id).success ? id : null;
};

/**
 * @function parseSimilarQuery
 * @param params {URLSearchParams} the query
 * @returns {SimilarQuery} each part, an unreadable one at its default (NM, no range, no pool)
 */
export const parseSimilarQuery = (params: URLSearchParams): SimilarQuery => {
  const pool = params.get("pool");
  return {
    lens: parseLens(params.get("mods")),
    sr: parseRange(params.get("sr"), STAR_RANGE),
    pool: pool !== null && BUILT_POOL_ID_PATTERN.test(pool) ? pool : null,
  };
};

/**
 * @function similarQueryFor
 * @param lens {BrowseLens} the browser's lens
 * @param bucket {string | null} the bucket Add goes to
 * @param targets {BucketTargets | undefined} the pool's targets
 * @param pool {string | undefined} the pool being edited
 * @returns {SimilarQuery} the lens, that bucket's target star range (when it has one) and the pool
 */
export const similarQueryFor = (
  lens: BrowseLens,
  bucket: string | null,
  targets: BucketTargets | undefined,
  pool: string | undefined,
): SimilarQuery => {
  const range = bucket ? targets?.[bucket]?.sr : undefined;
  return { lens, sr: range ? [range.min, range.max] : null, pool: pool ?? null };
};

/**
 * @function similarApiUrl
 * @param id {number} the map
 * @param query {SimilarQuery} the lens, range and pool
 * @returns {string} the route's URL (mods left out for NM)
 */
export const similarApiUrl = (id: number, { lens, sr, pool }: SimilarQuery): string => {
  const parts: string[] = [];
  if (lens !== "NM") parts.push(`mods=${lens}`);
  if (sr) parts.push(`sr=${rangeText(sr)}`);
  if (pool) parts.push(`pool=${pool}`);
  const path = `/api/maps/${id}/similar`;
  return parts.length > 0 ? `${path}?${parts.join("&")}` : path;
};
