/**
 * @file src/utils/search-ranges.ts
 * @desc Reading and writing filter values in URLs, shared by the search and the map browser
 *       (src/utils/browse-params.ts): ranges that snap to their slider (open at the edges; one
 *       covering the whole slider is no filter), lengths as m:ss or seconds, the page number,
 *       and query text made well formed. Pure, and safe in the browser.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Mon Sep 28, 2026
 */

import { type FilterBounds, LENGTH_RANGE, MAX_SEARCH_PAGE } from "@/constants/search";
import type { Range } from "@/utils/search-filters";

const round = (n: number, decimals: number): number => {
  const scale = 10 ** decimals;
  return Math.round(n * scale) / scale;
};

/**
 * @function normalizeRange
 * @param range {readonly [number, number | null]} a range from a slider or a URL
 * @param bounds {FilterBounds} the slider's bounds
 * @returns {Range | null} the range inside the bounds and rounded, its top null at the maximum;
 *          null when it covers the whole slider, is crossed, or isn't a number
 */
export const normalizeRange = (
  range: readonly [number, number | null],
  bounds: FilterBounds,
): Range | null => {
  const [rawLow, rawHigh] = range;
  if (!Number.isFinite(rawLow) || (rawHigh !== null && !Number.isFinite(rawHigh))) return null;
  const low = round(Math.min(Math.max(rawLow, bounds.min), bounds.max), bounds.decimals);
  const high =
    rawHigh === null || rawHigh >= bounds.max
      ? null
      : round(Math.max(rawHigh, bounds.min), bounds.decimals);
  if (high !== null && high < low) return null;
  if (low <= bounds.min && high === null) return null;
  return [low, high];
};

/**
 * @function parseLengthText
 * @param text {string} a typed length
 * @returns {number | null} seconds: "1:35" is 95, a bare number is minutes ("2,5" is 150); null
 *          for anything else
 */
export const parseLengthText = (text: string): number | null => {
  const trimmed = text.trim().replace(",", ".");
  const clock = /^(\d+):(\d+)$/.exec(trimmed);
  if (clock) return Number(clock[1]) * 60 + Number(clock[2]);
  if (/^\d+(\.\d+)?$/.test(trimmed)) return Math.round(Number(trimmed) * 60);
  return null;
};

const NUMBER = String.raw`\d+(?:[.,]\d+)?`;

const RANGE_TEXT = new RegExp(`^(${NUMBER})?-(${NUMBER})?$`);

const OPEN_TEXT = new RegExp(`^(${NUMBER})\\+?$`);

const toNumber = (text: string): number => Number(text.replace(",", "."));

/**
 * @function parseRange
 * @param raw {string | null} a range as written: "5.5-6.5", "6-", "-6.5", "6+" (6 and up)
 * @param bounds {FilterBounds} its slider
 * @returns {Range | null} the range snapped to the slider (normalizeRange), or null
 */
export const parseRange = (raw: string | null, bounds: FilterBounds): Range | null => {
  if (raw === null) return null;
  const text = raw.trim();
  const open = OPEN_TEXT.exec(text);
  if (open?.[1] !== undefined) return normalizeRange([toNumber(open[1]), null], bounds);
  const range = RANGE_TEXT.exec(text);
  if (!range || (range[1] === undefined && range[2] === undefined)) return null;
  return normalizeRange(
    [
      range[1] === undefined ? bounds.min : toNumber(range[1]),
      range[2] === undefined ? null : toNumber(range[2]),
    ],
    bounds,
  );
};

/**
 * @function parseLengthRange
 * @param raw {string | null} a length range in seconds, or clock times ("1:30-3:00")
 * @returns {Range | null} the range in seconds on LENGTH_RANGE, or null
 */
export const parseLengthRange = (raw: string | null): Range | null => {
  if (raw === null) return null;
  const [low, high, ...rest] = raw.split("-");
  if (rest.length > 0 || low === undefined || high === undefined)
    return parseRange(raw, LENGTH_RANGE);
  if (!low.includes(":") && !high.includes(":")) return parseRange(raw, LENGTH_RANGE);
  const from =
    low === "" ? LENGTH_RANGE.min : parseLengthText(low.includes(":") ? low : `0:${low}`);
  const to = high === "" ? null : parseLengthText(high.includes(":") ? high : `0:${high}`);
  if (from === null || (high !== "" && to === null)) return null;
  return normalizeRange([from, to], LENGTH_RANGE);
};

/**
 * @function parsePageParam
 * @param raw {string | null} an untrusted page number
 * @returns {number} 1 for anything that isn't a whole number from 1; at most MAX_SEARCH_PAGE
 */
export const parsePageParam = (raw: string | null): number =>
  raw !== null && /^[1-9]\d{0,5}$/.test(raw) ? Math.min(Number(raw), MAX_SEARCH_PAGE) : 1;

/**
 * @function rangeText
 * @param range {Range} a range
 * @returns {string} "5.5-6.5", or "6-" with no upper limit
 */
export const rangeText = ([low, high]: Range): string => `${low}-${high ?? ""}`;

/** A surrogate pair, or a surrogate on its own. */
const SURROGATES = /[\uD800-\uDBFF][\uDC00-\uDFFF]|[\uD800-\uDFFF]/g;

/**
 * @function wellFormed
 * @param text {string} typed text
 * @returns {string} the text with each lone surrogate as U+FFFD (encodeURIComponent throws on one)
 */
export const wellFormed = (text: string): string =>
  text.replace(SURROGATES, (match) => (match.length === 2 ? match : "�"));
