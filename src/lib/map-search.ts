/**
 * @file src/lib/map-search.ts
 * @desc The hinai mirror's search (GET /v3/osu/beatmaps/search/v2), called from our server only
 *       with pools' User-Agent and a 10 s timeout: osu!standard, one status (always sent), the
 *       star, BPM and length ranges, explicit maps only when asked, 50 a page from the mirror's
 *       page 0. Answers are JSON metadata only (never files), parsed with zod: unknown fields are
 *       ignored, a set that doesn't parse is dropped, and only osu!standard difficulties are
 *       kept. Anything but a 200 with a list of sets (an error body, a 4xx or 5xx, Cloudflare
 *       HTML, a dropped connection, a timeout) is a failure, never an empty page. Totals come
 *       from total_count (the mirror's own pages), osu!'s total (capped at 10000) or not at all
 *       (osu.direct). A 429 or 503 with Retry-After makes this process skip the mirror that
 *       long (at most a minute) and fail at once meanwhile; the map browser's mirror calls
 *       share that cool-down (isMirrorCooling, noteMirrorRetryAfter). Lives here, not in
 *       @haruhimemoe/hinai, until a second app needs it.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sat Sep 26, 2026
 * @modified Sun Sep 27, 2026
 */

import "server-only";
import { parseRetryAfter } from "@haruhimemoe/hinai";
import { z } from "zod";
import {
  BPM_RANGE,
  type FilterBounds,
  LENGTH_RANGE,
  MAX_SEARCH_PAGE,
  MIRROR_COOLDOWN_MAX_MS,
  MIRROR_SEARCH_TIMEOUT_MS,
  MIRROR_SEARCH_URL,
  MIRROR_TOTAL_CAP,
  SEARCH_PAGE_SIZE,
  STAR_RANGE,
} from "@/constants/search";
import { SERVER_USER_AGENT } from "@/constants/site";
import type { AllMapFilters, Range } from "@/utils/search-params";

const count = z.number().int().nonnegative();

/** An osu!standard difficulty, as the search lists it. */
const beatmapSchema = z
  .object({
    id: z.number().int().positive(),
    mode: z.literal("osu"),
    version: z.string(),
    difficulty_rating: z.number().nonnegative(),
    total_length: z.number().nonnegative(),
    bpm: z.number().nonnegative(),
  })
  .transform(({ id, version, difficulty_rating, total_length, bpm }) => ({
    id,
    version,
    stars: difficulty_rating,
    length: total_length,
    bpm,
  }));

export type MirrorBeatmap = z.output<typeof beatmapSchema>;

/** A beatmapset: what the page shows, and what the compliance rules read (when it's there). */
const setSchema = z.object({
  id: z.number().int().positive(),
  status: z.string(),
  artist: z.string(),
  title: z.string(),
  creator: z.string(),
  artist_unicode: z.string().nullish(),
  title_unicode: z.string().nullish(),
  source: z.string().nullish(),
  tags: z.string().nullish(),
  track_id: z.number().int().nullish(),
  availability: z
    .object({ download_disabled: z.boolean(), more_information: z.string().nullish() })
    .nullish(),
  beatmaps: z.array(z.unknown()),
});

export type MirrorSet = Omit<z.output<typeof setSchema>, "beatmaps"> & {
  beatmaps: MirrorBeatmap[];
};

const answerSchema = z.object({
  beatmapsets: z.array(z.unknown()),
  source: z.string().optional(),
  total_count: count.optional(),
  total: count.optional(),
});

/**
 * @function mirrorSearchUrl
 * @param filters {AllMapFilters} the search
 * @param page {number} pools' page, from 1
 * @returns {string} the mirror's search URL for it
 */
export const mirrorSearchUrl = (filters: AllMapFilters, page: number): string => {
  const params = new URLSearchParams();
  if (filters.q !== "") params.set("query", filters.q);
  params.set("mode", "0");
  params.set("status", filters.status);
  /** A bottom end at the slider's minimum is no lower limit. */
  const range = (low: string, high: string, value: Range | null, bounds: FilterBounds) => {
    if (!value) return;
    if (value[0] > bounds.min) params.set(low, String(value[0]));
    if (value[1] !== null) params.set(high, String(value[1]));
  };
  range("min_stars", "max_stars", filters.sr, STAR_RANGE);
  range("min_length", "max_length", filters.len, LENGTH_RANGE);
  range("min_bpm", "max_bpm", filters.bpm, BPM_RANGE);
  if (filters.explicit) params.set("explicit", "show");
  params.set("page", String(page - 1));
  params.set("limit", String(SEARCH_PAGE_SIZE));
  return `${MIRROR_SEARCH_URL}?${params}`;
};

export type MirrorSearch =
  | {
      ok: true;
      /** The sets that parsed, in the mirror's order. */
      sets: MirrorSet[];
      /** How many sets the mirror sent, parsed or not (with no total, any means maybe more). */
      received: number;
      /** Results in all, when the mirror says; osu!'s capped at 10000. */
      total: number | null;
    }
  | { ok: false; reason: string };

/** Until when (ms since the epoch) this process leaves the mirror's search alone. */
let coolUntil = 0;

/**
 * @function resetMirrorCooldown
 * @returns {void} forgets a Retry-After the mirror sent (tests)
 */
export const resetMirrorCooldown = (): void => {
  coolUntil = 0;
};

/**
 * @function isMirrorCooling
 * @param now {number} ms since the epoch
 * @returns {boolean} whether a Retry-After the mirror sent still runs
 */
export const isMirrorCooling = (now: number): boolean => now < coolUntil;

/**
 * @function noteMirrorRetryAfter
 * @param response {Response} a mirror answer
 * @param now {number} ms since the epoch
 * @returns {void} on a 429 or 503 with Retry-After, skips the mirror that long (at most
 *          MIRROR_COOLDOWN_MAX_MS); anything else changes nothing
 */
export const noteMirrorRetryAfter = (response: Response, now: number): void => {
  if (response.status !== 429 && response.status !== 503) return;
  const wait = parseRetryAfter(response.headers.get("Retry-After"), now);
  if (wait === null || wait <= 0) return;
  coolUntil = Math.max(coolUntil, now + Math.min(wait, MIRROR_COOLDOWN_MAX_MS));
};

/** A set that parses, with only the osu!standard difficulties that parse. */
const readSet = (raw: unknown): MirrorSet | null => {
  const parsed = setSchema.safeParse(raw);
  if (!parsed.success) return null;
  const beatmaps = parsed.data.beatmaps.flatMap((map) => {
    const beatmap = beatmapSchema.safeParse(map);
    return beatmap.success ? [beatmap.data] : [];
  });
  return { ...parsed.data, beatmaps };
};

/**
 * @function searchMirror
 * @param filters {AllMapFilters} the search
 * @param page {number} pools' page, from 1
 * @param deps {{ fetch?: typeof fetch; timeoutMs?: number; now?: () => number }} fetch, timeout
 *        and clock (tests)
 * @returns {Promise<MirrorSearch>} the page's sets and totals, or why the search failed (without
 *          asking the mirror while a Retry-After it sent still runs). Never rejects.
 */
export const searchMirror = async (
  filters: AllMapFilters,
  page: number,
  {
    fetch: doFetch = globalThis.fetch,
    timeoutMs = MIRROR_SEARCH_TIMEOUT_MS,
    now = Date.now,
  }: { fetch?: typeof fetch; timeoutMs?: number; now?: () => number } = {},
): Promise<MirrorSearch> => {
  if (isMirrorCooling(now()))
    return { ok: false, reason: "The mirror asked us to wait (Retry-After)." };
  let body: unknown;
  try {
    const response = await doFetch(mirrorSearchUrl(filters, page), {
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
  if (!answer.success) return { ok: false, reason: "The mirror's answer had no list of sets." };
  const { beatmapsets, total_count, total } = answer.data;
  return {
    ok: true,
    sets: beatmapsets.flatMap((raw) => readSet(raw) ?? []),
    received: beatmapsets.length,
    total: total_count ?? (total === undefined ? null : Math.min(total, MIRROR_TOTAL_CAP)),
  };
};

/**
 * @function mirrorPageCount
 * @param answer {{ total: number | null; received: number; page: number }} a page's totals
 * @returns {number} pages from the total (at most MAX_SEARCH_PAGE); with no total, one past this
 *          page whenever this one had sets (osu.direct's pages hold 48 to 50 at limit=50, so a
 *          short page isn't the end), else this page: an empty page is the end
 */
export const mirrorPageCount = ({
  total,
  received,
  page,
}: {
  total: number | null;
  received: number;
  page: number;
}): number => {
  const pages =
    total === null ? (received > 0 ? page + 1 : page) : Math.ceil(total / SEARCH_PAGE_SIZE);
  return Math.min(pages, MAX_SEARCH_PAGE);
};
