/**
 * @file tests/helpers/hinai-server.ts
 * @desc A stand-in for the mirror's batch endpoint (HINAI_BATCH_URL from hinai/testing) with
 *       rows built from otdb seeds, for tests whose maps the recorded rows don't cover; answered
 *       for the ids asked (unknown ids left out, as the mirror does). Tests that only need real
 *       mirror rows use hinai/testing's hinaiBatchHandler.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Mon Sep 28, 2026
 */

import { HINAI_BATCH_URL } from "@haruhimemoe/hinai/testing";
import { HttpResponse, http } from "msw";
import type { MapSeed } from "@/utils/map-record";

/**
 * @function mirrorRow
 * @param id {number} a beatmap id
 * @param seed {MapSeed} otdb's values for it
 * @param stars {number} the no-mod rating the mirror gives
 * @returns {Record<string, unknown>} a /api/v2/beatmaps row
 */
export const mirrorRow = (id: number, seed: MapSeed, stars = 5.5): Record<string, unknown> => ({
  id,
  beatmapset_id: seed.setId,
  mode: "osu",
  version: seed.version,
  difficulty_rating: stars,
  cs: seed.cs,
  ar: seed.ar,
  accuracy: seed.od,
  drain: seed.hp,
  bpm: seed.bpm,
  total_length: seed.length,
  checksum: null,
  beatmapset: { artist: seed.artist, title: seed.title, creator: seed.setHost, user_id: 2 },
});

/**
 * @function mirrorHandler
 * @param rows {ReadonlyMap<number, Record<string, unknown>>} the rows the mirror knows
 * @returns the msw handler for GET /api/v2/beatmaps?ids=
 */
export const mirrorHandler = (rows: ReadonlyMap<number, Record<string, unknown>>) =>
  http.get(HINAI_BATCH_URL, ({ request }) => {
    const ids = (new URL(request.url).searchParams.get("ids") ?? "")
      .split(",")
      .filter(Boolean)
      .map(Number);
    return HttpResponse.json(ids.flatMap((id) => rows.get(id) ?? []));
  });
