/**
 * @file src/lib/nekoha-search.ts
 * @desc The hinai mirror's search of its mod data (GET /api/v1/nekoha-collab/search), called
 *       from our server only with pools' User-Agent and a 10 s timeout: one mod lens, one status
 *       (always sent: the mirror reads none, or an empty one, as something else), osu!standard,
 *       the text, the star range under the lens, the sort picked (most favourited first unless
 *       another; "pp" is what the mirror does with any sort it doesn't know), 50 rows a page.
 *       Its pages start at 1 like pools' (page=0 answers page 1). One row is one difficulty:
 *       `stars` is under the lens, `difficulty_rating`, BPM and length are without mods (the
 *       mirror doesn't adjust a DT row's BPM or length). Parsed with zod: unknown fields are
 *       ignored and a row that doesn't parse, or isn't osu!standard, is dropped. An error
 *       status, a body that isn't the answer, ready or success false, another lens than asked,
 *       a dropped connection or a timeout is a failure, never an empty page. Shares the mirror
 *       search's Retry-After cool-down. JSON metadata only, never files.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

import "server-only";
import { z } from "zod";
import {
  BROWSE_PAGE_SIZE,
  BROWSE_TIMEOUT_MS,
  type BrowseLens,
  type BrowseSort,
  type LensStatus,
  NEKOHA_SEARCH_URL,
} from "@/constants/browse";
import { STAR_RANGE } from "@/constants/search";
import { SERVER_USER_AGENT } from "@/constants/site";
import { isMirrorCooling, noteMirrorRetryAfter } from "@/lib/map-search";
import type { Range } from "@/utils/search-filters";

export type NekohaQuery = {
  lens: BrowseLens;
  status: LensStatus;
  q: string;
  /** Star range under the lens. */
  sr: Range | null;
  /** One of the mirror's four sorts, or "pp" (its answer to anything else). */
  sort: BrowseSort;
  /** From 1. */
  page: number;
};

const rowSchema = z
  .object({
    beatmap_id: z.number().int().positive(),
    beatmapset_id: z.number().int().positive(),
    artist: z.string(),
    title: z.string(),
    creator: z.string(),
    version: z.string(),
    status: z.string(),
    mode: z.literal(0),
    stars: z.number().nonnegative(),
    difficulty_rating: z.number().nonnegative(),
    bpm: z.number().nonnegative(),
    total_length: z.number().nonnegative(),
  })
  .transform((row) => ({
    id: row.beatmap_id,
    setId: row.beatmapset_id,
    artist: row.artist,
    title: row.title,
    creator: row.creator,
    version: row.version,
    status: row.status,
    stars: row.stars,
    starsNoMod: row.difficulty_rating,
    bpm: row.bpm,
    length: row.total_length,
  }));

/** One difficulty: stars under the lens; stars without mods, BPM and length without mods. */
export type NekohaRow = z.output<typeof rowSchema>;

const answerSchema = z.object({
  success: z.boolean().optional(),
  ready: z.boolean().optional(),
  mod: z.string(),
  total: z.number().int().nonnegative(),
  maps: z.array(z.unknown()),
});

export type NekohaSearch =
  | { ok: true; rows: NekohaRow[]; received: number; total: number }
  | { ok: false; reason: string };

/**
 * @function nekohaSearchUrl
 * @param query {NekohaQuery} the search
 * @returns {string} the mirror's URL for it (a bottom star end at the slider's minimum is no
 *          lower limit)
 */
export const nekohaSearchUrl = ({ lens, status, q, sr, sort, page }: NekohaQuery): string => {
  const params = new URLSearchParams({ mods: lens, status, mode: "0" });
  if (q !== "") params.set("q", q);
  if (sr && sr[0] > STAR_RANGE.min) params.set("min_stars", String(sr[0]));
  if (sr && sr[1] !== null) params.set("max_stars", String(sr[1]));
  params.set("sort", sort);
  params.set("limit", String(BROWSE_PAGE_SIZE));
  params.set("page", String(page));
  return `${NEKOHA_SEARCH_URL}?${params}`;
};

/**
 * @function searchNekoha
 * @param query {NekohaQuery} the search
 * @param deps {{ fetch?: typeof fetch; timeoutMs?: number; now?: () => number }} fetch, timeout
 *        and clock (tests)
 * @returns {Promise<NekohaSearch>} the page's rows that parsed, how many came, and the total
 *          rows; or why it failed (without asking while a Retry-After runs). Never rejects.
 */
export const searchNekoha = async (
  query: NekohaQuery,
  {
    fetch: doFetch = globalThis.fetch,
    timeoutMs = BROWSE_TIMEOUT_MS,
    now = Date.now,
  }: { fetch?: typeof fetch; timeoutMs?: number; now?: () => number } = {},
): Promise<NekohaSearch> => {
  if (isMirrorCooling(now())) return { ok: false, reason: "The mirror asked us to wait." };
  let body: unknown;
  try {
    const response = await doFetch(nekohaSearchUrl(query), {
      headers: { Accept: "application/json", "User-Agent": SERVER_USER_AGENT },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      noteMirrorRetryAfter(response, now());
      return { ok: false, reason: `The mirror answered ${response.status}.` };
    }
    body = await response.json();
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }
  const answer = answerSchema.safeParse(body);
  if (!answer.success) return { ok: false, reason: "The mirror's answer had no rows." };
  const { success, ready, mod, total, maps } = answer.data;
  if (success === false || ready === false) {
    return { ok: false, reason: "The mirror's mod data isn't ready." };
  }
  if (mod !== query.lens) return { ok: false, reason: `The mirror answered ${mod}.` };
  const rows = maps.flatMap((raw) => {
    const row = rowSchema.safeParse(raw);
    return row.success ? [row.data] : [];
  });
  return { ok: true, rows, received: maps.length, total };
};
