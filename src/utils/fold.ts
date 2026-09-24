/**
 * @file src/utils/fold.ts
 * @desc Search folding shared by stored search text, sort keys and queries: NFKD with the
 *       diacritics removed, lowercase ("PokÉmon" is "pokemon", "ＯＷＣ" is "owc"); a query's
 *       terms; and regex escaping, so typed text only ever matches as plain text. Pure.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

/**
 * @function foldForSearch
 * @param text {string} any text
 * @returns {string} NFKD, marks removed, lowercase
 */
export const foldForSearch = (text: string): string =>
  text.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();

/**
 * @function searchTextOf
 * @param parts {readonly (string | null | undefined)[]} the texts to search in
 * @returns {string} the non-empty ones, folded, one per line
 */
export const searchTextOf = (...parts: readonly (string | null | undefined)[]): string =>
  foldForSearch(
    parts.filter((part): part is string => typeof part === "string" && part !== "").join("\n"),
  );

/**
 * @function searchTerms
 * @param query {string} what was typed
 * @returns {string[]} its folded words (every one must match)
 */
export const searchTerms = (query: string): string[] =>
  foldForSearch(query).split(/\s+/u).filter(Boolean);

/**
 * @function escapeRegExp
 * @param text {string} untrusted text
 * @returns {string} the text with every regex metacharacter escaped
 */
export const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
