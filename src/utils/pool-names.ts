/**
 * @file src/utils/pool-names.ts
 * @desc Tournament, round and year from a pool's name. Sources give
 *       one string ("osu! World Cup 2023 Grand Finals"): the first round token splits it, the
 *       tournament is everything before it, and the round is the token and everything after it
 *       (a tier, division or bracket like "(20k-10k)" stays with the round), each token in its
 *       usual spelling ("RO16" is "Round of 16", "Grandfinals" is "Grand Finals"). A name
 *       without a token keeps the whole name as the tournament and no round. The year is the
 *       first 20xx in the name. Also the name's parts with that year taken out of the
 *       tournament ("OZT2018" is "OZT"), and the tournament key pools groups a series by. Pure.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

/** What a pool's name says. */
export type PoolName = { tournament: string; round: string | null; year: number | null };

type RoundToken = { pattern: RegExp; label: (match: RegExpExecArray) => string };

const titleCase = (word: string): string =>
  word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();

/**
 * Round tokens and how each is written. When two start at the same place, the longer match wins
 * ("Final Stage" over "Final"). Typos seen in real names are here too ("Qaurterfinal").
 */
export const ROUND_TOKENS: readonly RoundToken[] = Object.freeze<RoundToken[]>([
  { pattern: /\bgrand\s*-?\s*finals?\b/iu, label: () => "Grand Finals" },
  { pattern: /\bsemi\s*-?\s*finals?\b/iu, label: () => "Semifinals" },
  { pattern: /\bq(?:uarter|uater|aurter)\s*-?\s*finals?\b/iu, label: () => "Quarterfinals" },
  { pattern: /\bfinals?\b/iu, label: () => "Finals" },
  { pattern: /\b(?:round\s+of|ro)\s*(\d{1,4})\b/iu, label: (m) => `Round of ${Number(m[1])}` },
  { pattern: /\bswiss\s+round\s*(\d{1,2})\b/iu, label: (m) => `Swiss Round ${Number(m[1])}` },
  { pattern: /\bround\s*(\d{1,2})\b/iu, label: (m) => `Round ${Number(m[1])}` },
  { pattern: /\bgroups?(?:\s+stage)?\b/iu, label: () => "Group Stage" },
  { pattern: /\bqualifiers?\b|\bquals\b/iu, label: () => "Qualifiers" },
  { pattern: /\bplay\s*-?\s*ins?\b/iu, label: () => "Play-ins" },
  {
    pattern: /\b(first|second|third|final)\s+stage\b/iu,
    label: (m) => `${titleCase(m[1] ?? "")} Stage`,
  },
  { pattern: /\bstage\s*(\d{1,2})\b/iu, label: (m) => `Stage ${Number(m[1])}` },
  { pattern: /\bweek\s*(\d{1,2})\b/iu, label: (m) => `Week ${Number(m[1])}` },
  { pattern: /\bday\s*(\d{1,2})\b/iu, label: (m) => `Day ${Number(m[1])}` },
  { pattern: /\btier\s*(\d{1,2})\b/iu, label: (m) => `Tier ${Number(m[1])}` },
  {
    pattern: /\bdivision\s+([a-z]|[ivx]{1,4}|\d{1,2})\b/iu,
    label: (m) => `Division ${(m[1] ?? "").toUpperCase()}`,
  },
]);

type Found = { index: number; length: number; label: string };

/** The first round token at or after `from`: earliest start, then longest. */
const findToken = (text: string, from: number): Found | null => {
  let best: Found | null = null;
  const rest = text.slice(from);
  for (const { pattern, label } of ROUND_TOKENS) {
    const match = pattern.exec(rest);
    if (!match) continue;
    const found = { index: from + match.index, length: match[0].length, label: label(match) };
    if (
      best === null ||
      found.index < best.index ||
      (found.index === best.index && found.length > best.length)
    ) {
      best = found;
    }
  }
  return best;
};

/** Every round token in the text written its usual way; everything else as it was. */
const canonicalRound = (text: string): string => {
  let out = "";
  let at = 0;
  for (let found = findToken(text, 0); found !== null; found = findToken(text, at)) {
    out += text.slice(at, found.index) + found.label;
    at = found.index + found.length;
  }
  return (out + text.slice(at)).replace(/\s+/gu, " ").trim();
};

/** 2007 (osu!'s first year) to 2099, not glued to other digits ("OZT2018" counts). */
const YEAR = /(?<!\d)(20\d{2})(?!\d)/u;
const FIRST_YEAR = 2007;

const yearIn = (text: string): number | null => {
  const match = YEAR.exec(text);
  const year = match ? Number(match[1]) : null;
  return year !== null && year >= FIRST_YEAR ? year : null;
};

/** Separators a tournament name shouldn't end with ("Cup -", "Cup:"). */
const TRAILING = /[\s\-–—:|/,]+$/u;

/**
 * @function parsePoolName
 * @param name {string} a pool's name at its source
 * @returns {PoolName} the tournament (the name before its first round token, or the whole
 *          name when there is none or nothing comes before it), the round (the token onward, in
 *          its usual spelling, or null), and the year (the first 20xx in the tournament, else in
 *          the whole name, or null)
 */
export const parsePoolName = (name: string): PoolName => {
  const whole = name.replace(/\s+/gu, " ").trim();
  const found = findToken(whole, 0);
  const tournament = found ? whole.slice(0, found.index).replace(TRAILING, "") : "";
  if (!found || tournament === "") {
    return { tournament: whole, round: null, year: yearIn(whole) };
  }
  return {
    tournament,
    round: canonicalRound(whole.slice(found.index)),
    year: yearIn(tournament) ?? yearIn(whole),
  };
};

/** Brackets left empty once the year is gone ("Cup (2019)" is "Cup"). */
const EMPTY_BRACKETS = /\(\s*\)|\[\s*\]/gu;
/** Separators a tournament name shouldn't start with. */
const LEADING = /^[\s\-–—:|/,]+/u;

/**
 * @function withoutYear
 * @param text {string} a tournament name
 * @param year {number | null} its year
 * @returns {string} the name without that year (glued ones too: "OZT2018" is "OZT"), spaces
 *          collapsed, no separator or empty brackets left at either end; the name as it was when
 *          the year isn't in it or nothing else would be left
 */
export const withoutYear = (text: string, year: number | null): string => {
  const whole = text.replace(/\s+/gu, " ").trim();
  if (year === null) return whole;
  const stripped = whole
    .replace(new RegExp(`(?<!\\d)${year}(?!\\d)`, "u"), " ")
    .replace(EMPTY_BRACKETS, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .replace(TRAILING, "")
    .replace(LEADING, "");
  return stripped === "" ? whole : stripped;
};

/**
 * @function namePartsOf
 * @param name {string} a pool's name
 * @returns {PoolName} parsePoolName's tournament, round and year, the year taken out of the
 *          tournament ("osu! World Cup 2023 Grand Finals" is osu! World Cup, Grand Finals, 2023)
 */
export const namePartsOf = (name: string): PoolName => {
  const parsed = parsePoolName(name);
  return { ...parsed, tournament: withoutYear(parsed.tournament, parsed.year) };
};

/** The key of a tournament name made only of symbols. */
const UNNAMED_KEY = "unnamed";

/**
 * @function tournamentKey
 * @param tournament {string} a tournament name, with or without its year
 * @param year {number | null} its year
 * @returns {string} NFKC, the year token removed (glued forms too), lowercase, every run of
 *          characters that aren't letters or digits one "-", none at either end
 *          ("osu! World Cup 2023" is "osu-world-cup"); "unnamed" when nothing is left
 */
export const tournamentKey = (tournament: string, year: number | null): string => {
  const key = withoutYear(tournament.normalize("NFKC"), year)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/gu, "");
  return key === "" ? UNNAMED_KEY : key;
};
