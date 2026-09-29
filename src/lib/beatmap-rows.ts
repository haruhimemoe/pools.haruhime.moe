/**
 * @file src/lib/beatmap-rows.ts
 * @desc Difficulties by id from the hinai mirror's osu!-shaped lookup (GET /api/v2/beatmaps?ids=,
 *       server only, SERVER_USER_AGENT, 10 s timeout, one call for up to 50 ids), keeping what
 *       Find similar needs, the set's status among it (the hinai client's getBeatmaps drops it,
 *       and the compliance judgement needs it). Parsed with zod: a row that doesn't parse is
 *       left out, so its id reads as missing. An error status, a body that isn't a list, a
 *       dropped connection or a timeout is a failure; it shares the mirror search's Retry-After
 *       cool-down (a timeout starts it). JSON metadata only, never files. Never rejects.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import "server-only";
import { z } from "zod";
import { MIRROR_BEATMAPS_TIMEOUT_MS, MIRROR_BEATMAPS_URL } from "@/constants/similar";
import { SERVER_USER_AGENT } from "@/constants/site";
import { isMirrorCooling, noteMirrorRetryAfter, noteMirrorTimeout } from "@/lib/map-search";

const rowSchema = z
  .object({
    id: z.number().int().positive(),
    beatmapset_id: z.number().int().positive(),
    mode: z.string(),
    version: z.string(),
    difficulty_rating: z.number().nonnegative(),
    cs: z.number(),
    ar: z.number(),
    accuracy: z.number(),
    bpm: z.number().nonnegative(),
    total_length: z.number().nonnegative(),
    beatmapset: z.object({
      artist: z.string(),
      title: z.string(),
      creator: z.string(),
      status: z.string(),
    }),
  })
  .transform((row) => ({
    id: row.id,
    setId: row.beatmapset_id,
    mode: row.mode,
    version: row.version,
    stars: row.difficulty_rating,
    cs: row.cs,
    ar: row.ar,
    od: row.accuracy,
    bpm: row.bpm,
    length: row.total_length,
    artist: row.beatmapset.artist,
    title: row.beatmapset.title,
    creator: row.beatmapset.creator,
    status: row.beatmapset.status,
  }));

/** One difficulty without mods, with its set's artist, title, mapper and status. */
export type BeatmapRow = z.output<typeof rowSchema>;

/** The rows by id, or why the lookup failed. */
export type BeatmapRows =
  | { ok: true; rows: Map<number, BeatmapRow> }
  | { ok: false; reason: string };

/**
 * @function getBeatmapRows
 * @param ids {readonly number[]} up to 50 beatmap ids
 * @param deps {{ fetch?: typeof fetch; timeoutMs?: number; now?: () => number }} fetch, timeout
 *        and clock (tests)
 * @returns {Promise<BeatmapRows>} the rows that parsed, by id (ids the mirror lacks are absent),
 *          or a failure (without asking while a Retry-After runs)
 */
export const getBeatmapRows = async (
  ids: readonly number[],
  {
    fetch: doFetch = globalThis.fetch,
    timeoutMs = MIRROR_BEATMAPS_TIMEOUT_MS,
    now = Date.now,
  }: { fetch?: typeof fetch; timeoutMs?: number; now?: () => number } = {},
): Promise<BeatmapRows> => {
  if (ids.length === 0) return { ok: true, rows: new Map() };
  if (isMirrorCooling(now())) return { ok: false, reason: "The mirror asked us to wait." };
  let body: unknown;
  try {
    const response = await doFetch(`${MIRROR_BEATMAPS_URL}?ids=${ids.join(",")}`, {
      headers: { Accept: "application/json", "User-Agent": SERVER_USER_AGENT },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      noteMirrorRetryAfter(response, now());
      return { ok: false, reason: `The mirror answered ${response.status}.` };
    }
    body = await response.json();
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") noteMirrorTimeout(now());
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }
  if (!Array.isArray(body)) return { ok: false, reason: "The mirror's answer wasn't a list." };
  const asked = new Set(ids);
  const rows = new Map<number, BeatmapRow>();
  for (const raw of body) {
    const row = rowSchema.safeParse(raw);
    if (row.success && asked.has(row.data.id)) rows.set(row.data.id, row.data);
  }
  return { ok: true, rows };
};
