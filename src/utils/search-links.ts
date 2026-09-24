/**
 * @file src/utils/search-links.ts
 * @desc Where the home page's map box goes: the map's page when the whole input is one beatmap
 *       ID or difficulty link, otherwise a maps search (query cut to 100 UTF-16 units, never
 *       inside an emoji or styled letter). Pure, never throws.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { parseBeatmapRef } from "@haruhimemoe/pool";
import { MAX_QUERY_LENGTH } from "@/constants/search";

/** A high surrogate at the end, left behind when the cut splits a pair. */
const TRAILING_HIGH_SURROGATE = /[\uD800-\uDBFF]$/;

/** A surrogate pair, or a surrogate on its own. */
const SURROGATES = /[\uD800-\uDBFF][\uDC00-\uDFFF]|[\uD800-\uDFFF]/g;

/** Each lone surrogate as U+FFFD (encodeURIComponent throws on one). */
const wellFormed = (text: string): string =>
  text.replace(SURROGATES, (match) => (match.length === 2 ? match : "�"));

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
  const cut = text.slice(0, MAX_QUERY_LENGTH).replace(TRAILING_HIGH_SURROGATE, "");
  const q = wellFormed(cut).trim();
  return q === "" ? "/search?tab=maps" : `/search?tab=maps&q=${encodeURIComponent(q)}`;
};
