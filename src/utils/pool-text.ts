/**
 * @file src/utils/pool-text.ts
 * @desc How pages write a pool's parts: the year ("year unknown" when the name has none), the
 *       headline (tournament · round · year), badged (only when known) and no-mod stars. Pure.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { formatStars } from "@/utils/format";

/**
 * @function yearText
 * @param year {number | null} a pool's year
 * @returns {string} the year, or "year unknown"
 */
export const yearText = (year: number | null): string =>
  year === null ? "year unknown" : String(year);

/**
 * @function poolHeadline
 * @param pool {{ tournament: string; round: string | null; year: number | null }} a pool
 * @returns {string} "osu! World Cup · Grand Finals · 2023" (no round: left out)
 */
export const poolHeadline = (pool: {
  tournament: string;
  round: string | null;
  year: number | null;
}): string =>
  [pool.tournament, pool.round, yearText(pool.year)]
    .filter((part): part is string => typeof part === "string" && part !== "")
    .join(" · ");

/**
 * @function badgedText
 * @param badged {boolean | null} whether the tournament was badged
 * @returns {string | null} "Badged", "Not badged", or null when nobody knows
 */
export const badgedText = (badged: boolean | null): string | null =>
  badged === null ? null : badged ? "Badged" : "Not badged";

/**
 * @function starsText
 * @param stars {number | null} a no-mod star rating
 * @returns {string} "5.50★", or "–" when not known
 */
export const starsText = (stars: number | null): string =>
  stars === null ? "–" : `${formatStars(stars)}★`;
