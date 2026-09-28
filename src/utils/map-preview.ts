/**
 * @file src/utils/map-preview.ts
 * @desc Map previews, loaded by the browser straight from osu!'s CDN (pools never proxies or
 *       stores them): a set's list cover (assets.ppy.sh) and its preview clip (b.ppy.sh), and
 *       the cover's alt text and the play button's name. next.config.ts's CSP allows exactly
 *       these two hosts for them. Pure, and safe in the browser.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { coverUrl } from "@haruhimemoe/osu/shapes";
import { mapLabel } from "@/utils/map-record";

/**
 * @function previewCoverUrl
 * @param setId {number} a beatmapset
 * @returns {string} its small square cover on assets.ppy.sh
 */
export const previewCoverUrl = (setId: number): string => coverUrl(setId, "list");

/**
 * @function previewClipUrl
 * @param setId {number} a beatmapset
 * @returns {string} its preview clip on b.ppy.sh
 */
export const previewClipUrl = (setId: number): string => `https://b.ppy.sh/preview/${setId}.mp3`;

/**
 * @function coverAlt
 * @param song {string} "Artist - Title"
 * @returns {string} the cover's alt text
 */
export const coverAlt = (song: string): string => `Cover art for ${song}`;

/**
 * @function previewLabel
 * @param song {string} "Artist - Title"
 * @param playing {boolean} whether its clip is playing
 * @returns {string} the play button's name
 */
export const previewLabel = (song: string, playing: boolean): string =>
  `${playing ? "Stop" : "Play"} preview of ${song}`;

/**
 * @function songOf
 * @param map {{ artist: string | null; title: string | null } | null | undefined} a map's details
 * @param beatmapId {number} its id, for a map not known yet
 * @returns {string} "Artist - Title", or "Beatmap <id>"
 */
export const songOf = (
  map: { artist: string | null; title: string | null } | null | undefined,
  beatmapId: number,
): string =>
  mapLabel({ artist: map?.artist ?? null, title: map?.title ?? null, version: null }, beatmapId);
