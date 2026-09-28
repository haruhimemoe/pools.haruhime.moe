/**
 * @file tests/helpers/pp-batch.ts
 * @desc A stand-in for the mirror's GET /v3/osu/pp/batch?ids=&mods=: rows shaped like the live
 *       answer ({ results: { "<id>": {...} }, missing, mods, game_mode }), answered for the ids a
 *       test knows under the asked combo (the rest missing), recording each call's ids, combo
 *       and User-Agent; or a mirror that never answers some combos (6.5 stars for the others).
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

import { HttpResponse, http } from "msw";
import { PP_BATCH_URL } from "@/constants/mod-values";

export type BatchCall = { ids: number[]; mods: string | null; userAgent: string | null };

/**
 * @function ppValues
 * @param extra {Record<string, unknown>} values to change
 * @returns {Record<string, unknown>} one id's values as the mirror sends them (hp and max_combo
 *          null, as they are live)
 */
export const ppValues = (extra: Record<string, unknown> = {}): Record<string, unknown> => ({
  ar: 9,
  bpm: 180,
  cs: 4,
  hp: null,
  max_combo: null,
  od: 8,
  pp: 250.5,
  stars: 5.5,
  ...extra,
});

/** The ids and combo a pp/batch URL asks for. */
const asked = (url: URL) => ({
  ids: (url.searchParams.get("ids") ?? "").split(",").filter(Boolean).map(Number),
  mods: url.searchParams.get("mods"),
});

/**
 * @function ppBatchHandler
 * @param known {(id: number, mods: string) => Record<string, unknown> | undefined} what the
 *        mirror has for an id under a combo (undefined: missing)
 * @param calls {BatchCall[]} filled with every request
 * @returns the msw handler
 */
export const ppBatchHandler = (
  known: (id: number, mods: string) => Record<string, unknown> | undefined,
  calls: BatchCall[] = [],
) =>
  http.get(PP_BATCH_URL, ({ request }) => {
    const { ids, mods } = asked(new URL(request.url));
    calls.push({ ids, mods, userAgent: request.headers.get("user-agent") });
    const results: Record<string, unknown> = {};
    const missing: number[] = [];
    for (const id of ids) {
      const row = known(id, mods ?? "NM");
      if (row) results[String(id)] = row;
      else missing.push(id);
    }
    return HttpResponse.json({
      game_mode: 0,
      max_ids: 100,
      missing,
      mods: mods ?? "NM",
      requested: ids.length,
      resolved: ids.length - missing.length,
      results,
      success: true,
    });
  });

/**
 * @function ppBatchAnswering
 * @param answer {(url: URL) => Response} what the mirror says
 * @param calls {BatchCall[]} filled with every request
 * @returns the msw handler
 */
export const ppBatchAnswering = (answer: (url: URL) => Response, calls: BatchCall[] = []) =>
  http.get(PP_BATCH_URL, ({ request }) => {
    const url = new URL(request.url);
    calls.push({ ...asked(url), userAgent: request.headers.get("user-agent") });
    return answer(url);
  });

/**
 * @function ppBatchHanging
 * @param calls {BatchCall[]} filled with every request
 * @param answersFor {(mods: string) => boolean} combos that get an answer (none by default); the
 *        rest never answer, as a mirror that hangs
 * @returns the msw handler
 */
export const ppBatchHanging = (
  calls: BatchCall[] = [],
  answersFor: (mods: string) => boolean = () => false,
) =>
  http.get(PP_BATCH_URL, async ({ request }) => {
    const url = new URL(request.url);
    calls.push({ ...asked(url), userAgent: request.headers.get("user-agent") });
    const { ids, mods } = asked(url);
    if (!answersFor(mods ?? "NM")) await new Promise(() => {});
    const results = Object.fromEntries(ids.map((id) => [String(id), ppValues({ stars: 6.5 })]));
    return HttpResponse.json({ mods: mods ?? "NM", results, success: true });
  });
