/**
 * @file src/utils/search-links.ts
 * @desc Where the home page's map box goes: the map's page when the whole input is one beatmap
 *       ID or difficulty link, otherwise a maps search (query cut to 100 characters). Pure.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { parseBeatmapRef } from "@haruhimemoe/pool";
import { MAX_QUERY_LENGTH } from "@/constants/search";

/**
 * @function mapSearchTarget
 * @param query {string} what was typed
 * @returns {string} "/maps/<id>" or "/search?tab=maps[&q=...]"
 */
export const mapSearchTarget = (query: string): string => {
  const text = query.trim();
  if (text !== "" && !/\s/u.test(text)) {
    const ref = parseBeatmapRef(text);
    if (ref.ok) return `/maps/${ref.beatmapId}`;
  }
  const q = text.slice(0, MAX_QUERY_LENGTH).trim();
  return q === "" ? "/search?tab=maps" : `/search?tab=maps&q=${encodeURIComponent(q)}`;
};
