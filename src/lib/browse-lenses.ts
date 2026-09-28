/**
 * @file src/lib/browse-lenses.ts
 * @desc The mod lenses the map browser offers: the combos in BROWSE_LENSES that the mirror's
 *       GET /v3/osu/pp-maps/stats also lists in available_mods (NM always), in picker order.
 *       Server only, pools' User-Agent, 10 s timeout. This process keeps the list an hour,
 *       with one call for requests that arrive together. When it can't be read (an error
 *       status, a body without available_mods, a dropped connection, a Retry-After running)
 *       the built-in list is used, and the mirror is asked again after a minute.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

import "server-only";
import { z } from "zod";
import {
  BROWSE_LENSES,
  BROWSE_TIMEOUT_MS,
  type BrowseLens,
  DEFAULT_LENS,
  LENS_LIST_RETRY_MS,
  LENS_LIST_TTL_MS,
  PP_MAPS_STATS_URL,
} from "@/constants/browse";
import { SERVER_USER_AGENT } from "@/constants/site";
import { isMirrorCooling, noteMirrorRetryAfter } from "@/lib/map-search";

export type LensDeps = { fetch?: typeof fetch; timeoutMs?: number; now?: () => number };

const statsSchema = z.object({ available_mods: z.array(z.string()) });

let kept: { lenses: readonly BrowseLens[]; until: number } | null = null;
let asking: Promise<readonly BrowseLens[]> | null = null;

/**
 * @function resetLensList
 * @returns {void} forgets the kept list (tests)
 */
export const resetLensList = (): void => {
  kept = null;
  asking = null;
};

/** The mirror's combos, or null when they can't be read. */
const listed = async (
  doFetch: typeof fetch,
  timeoutMs: number,
  now: number,
): Promise<string[] | null> => {
  try {
    const response = await doFetch(PP_MAPS_STATS_URL, {
      headers: { Accept: "application/json", "User-Agent": SERVER_USER_AGENT },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      noteMirrorRetryAfter(response, now);
      return null;
    }
    const stats = statsSchema.safeParse(await response.json());
    return stats.success ? stats.data.available_mods : null;
  } catch (error) {
    console.error("[browse-lenses] couldn't read the mirror's combos", error);
    return null;
  }
};

/**
 * @function availableLenses
 * @param deps {LensDeps} fetch, timeout and clock (tests)
 * @returns {Promise<readonly BrowseLens[]>} the lenses to offer, in picker order. Never rejects.
 */
export const availableLenses = async ({
  fetch: doFetch = globalThis.fetch,
  timeoutMs = BROWSE_TIMEOUT_MS,
  now = Date.now,
}: LensDeps = {}): Promise<readonly BrowseLens[]> => {
  const at = now();
  if (kept && at < kept.until) return kept.lenses;
  if (isMirrorCooling(at)) return BROWSE_LENSES;
  asking ??= listed(doFetch, timeoutMs, at).then((mods) => {
    const lenses =
      mods === null
        ? BROWSE_LENSES
        : BROWSE_LENSES.filter((lens) => lens === DEFAULT_LENS || mods.includes(lens));
    kept = { lenses, until: at + (mods === null ? LENS_LIST_RETRY_MS : LENS_LIST_TTL_MS) };
    asking = null;
    return lenses;
  });
  return asking;
};
