/**
 * @file src/constants/similar.ts
 * @desc Find similar (GET /api/maps/<id>/similar): how many neighbors a map has, the mirror's
 *       beatmap lookup it loads them through, the "difficulty match" fallback's weights and
 *       scales, the two methods' labels, BoBERT's credit, and the copy the browser shows.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

/** Neighbors per map in similar_maps (scripts/similar keeps the top 20). */
export const SIMILAR_COUNT = 20;

/** The mirror's osu!-shaped beatmap lookup (with each set's status), 50 ids a call at most. */
export const MIRROR_BEATMAPS_URL = "https://mirror.hinamizawa.ai/api/v2/beatmaps";

/** How long the lookup may take. */
export const MIRROR_BEATMAPS_TIMEOUT_MS = 10_000;

/** How far the fallback's candidates may be from the map's stars, either way. */
export const FALLBACK_STAR_SPREAD = 0.3;

/**
 * The fallback's weighted distance: each value's difference over its scale, squared, times its
 * weight. Stars stand in for aim and speed strain, which the mirror doesn't send.
 */
export const FALLBACK_WEIGHTS = Object.freeze({
  stars: { weight: 3, scale: 0.25 },
  bpm: { weight: 2, scale: 15 },
  length: { weight: 1, scale: 45 },
  ar: { weight: 1, scale: 0.5 },
  od: { weight: 1, scale: 0.75 },
  cs: { weight: 1, scale: 0.5 },
});

/** How the maps were found. */
export const SIMILAR_METHODS = ["pattern", "difficulty"] as const;
/** One of SIMILAR_METHODS. */
export type SimilarMethod = (typeof SIMILAR_METHODS)[number];

/** Each method's name and what it means. */
export const SIMILAR_METHOD_TEXT: Record<SimilarMethod, { label: string; about: string }> = {
  pattern: {
    label: "Pattern match",
    about:
      "Maps whose hit objects play alike, from BoBERT's embeddings. AR, OD and CS aren't part of it.",
  },
  difficulty: {
    label: "Difficulty match",
    about:
      "This map isn't in BoBERT's table, so these are ranked maps with close stars, BPM, length, AR, OD and CS under the mods.",
  },
};

/** BoBERT's credit, shown next to the results and on /credits. */
export const BOBERT_CREDIT = Object.freeze({
  name: "BoBERT",
  author: "token03",
  url: "https://github.com/token03/bobert",
  license: "MIT",
});

/** The failure copy and code (503). */
export const SIMILAR_FAILED = "Similar maps aren't available right now.";
/** The 503's code. */
export const SIMILAR_UNAVAILABLE_CODE = "similar_unavailable";
/** The copy when nothing is left after the filters. */
export const SIMILAR_EMPTY = "No similar maps left after the filters under these mods.";
