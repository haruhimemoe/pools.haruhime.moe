/**
 * @file src/utils/map-preview.ts
 * @desc The song name a map's preview button reads out. The clip and cover URLs come from
 *       @haruhimemoe/ui.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Oct 5, 2026
 */

import { mapLabel } from "@/utils/map-record";

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
