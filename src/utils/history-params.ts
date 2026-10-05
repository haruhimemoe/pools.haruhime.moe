/**
 * @file src/utils/history-params.ts
 * @desc Reads the history page's `?before=` paging cursor from an untrusted query value. Pure.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Oct 5, 2026
 * @modified Mon Oct 5, 2026
 */

/**
 * @function seqParam
 * @param value {string | string[] | undefined} a query param's raw value
 * @returns {number | undefined} a non-negative integer, or undefined for anything else
 */
export const seqParam = (value: string | string[] | undefined): number | undefined => {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return undefined;
  const seq = Number(value);
  return Number.isSafeInteger(seq) ? seq : undefined;
};
