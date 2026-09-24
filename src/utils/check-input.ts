/**
 * @file src/utils/check-input.ts
 * @desc What /check reads from a paste, in this order: a pack key anywhere in it (a damaged key
 *       is reported, and nothing else is read), then a pasted pool (any slot line like "NM1
 *       129891"; "#" comment lines skipped), then bare beatmap IDs and difficulty links (each id
 *       once). At most 64 distinct maps. Pure, and safe in the browser.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import {
  BEATMAP_REF_MESSAGES,
  decodePackKey,
  extractPackKey,
  PACK_KEY_ERROR_MESSAGES,
  PackKeyError,
  parseBeatmapRef,
  parsePoolText,
  slotLabel,
} from "@haruhimemoe/pool";
import { MAX_CHECK_IDS } from "@/constants/compliance";

/** One map to show: its slot label (a key or pasted pool) or none (bare IDs). */
export type CheckRow = { label: string | null; beatmapId: number };

export type CheckInput =
  | { kind: "key" | "pool" | "ids"; name: string | null; rows: CheckRow[]; problems: string[] }
  | { kind: "empty"; problems: string[] };

type Filled = Extract<CheckInput, { rows: CheckRow[] }>;

const TOKEN_SHOWN = 80;

/** Keeps the first 64 distinct maps (bare IDs also drop repeats), and says so when it drops any. */
const capped = (input: Filled): Filled => {
  const seen = new Set<number>();
  const rows: CheckRow[] = [];
  let dropped = false;
  for (const row of input.rows) {
    if (seen.has(row.beatmapId)) {
      if (input.kind !== "ids") rows.push(row);
      continue;
    }
    if (seen.size >= MAX_CHECK_IDS) {
      dropped = true;
      continue;
    }
    seen.add(row.beatmapId);
    rows.push(row);
  }
  return {
    ...input,
    rows,
    problems: dropped
      ? [...input.problems, `Only the first ${MAX_CHECK_IDS} maps are checked.`]
      : input.problems,
  };
};

/**
 * @function readCheckInput
 * @param text {string} what was pasted
 * @returns {CheckInput} the maps to check and what couldn't be read
 */
export const readCheckInput = (text: string): CheckInput => {
  const key = extractPackKey(text);
  if (key !== null) {
    try {
      const pool = decodePackKey(key);
      return capped({
        kind: "key",
        name: pool.name,
        rows: pool.slots.map((slot) => ({ label: slotLabel(slot), beatmapId: slot.beatmapId })),
        problems: [],
      });
    } catch (error) {
      return {
        kind: "empty",
        problems: [
          error instanceof PackKeyError
            ? PACK_KEY_ERROR_MESSAGES[error.code]
            : "That pack key can't be read.",
        ],
      };
    }
  }
  const pasted = parsePoolText(text, { slots: [] });
  if (pasted.slots.some((slot) => slot.mod !== null)) {
    return capped({
      kind: "pool",
      name: null,
      rows: pasted.slots.map((slot) => ({ label: slotLabel(slot), beatmapId: slot.beatmapId })),
      problems: pasted.errors.map((error) => `Line ${error.line}: ${error.reason}`),
    });
  }
  const rows: CheckRow[] = [];
  const problems: string[] = [];
  const tokens = text
    .split(/\r?\n/u)
    .filter((line) => !line.trim().startsWith("#"))
    .flatMap((line) => line.split(/[\s,]+/u))
    .filter(Boolean);
  for (const token of tokens) {
    const ref = parseBeatmapRef(token);
    if (ref.ok) rows.push({ label: null, beatmapId: ref.beatmapId });
    else problems.push(`${token.slice(0, TOKEN_SHOWN)}: ${BEATMAP_REF_MESSAGES[ref.reason]}`);
  }
  if (rows.length === 0 && problems.length === 0) return { kind: "empty", problems: [] };
  return capped({ kind: "ids", name: null, rows, problems });
};

/**
 * @function checkIds
 * @param input {CheckInput} what was read
 * @returns {number[]} the distinct beatmap ids, ascending (one CDN key for everyone)
 */
export const checkIds = (input: CheckInput): number[] =>
  input.kind === "empty"
    ? []
    : [...new Set(input.rows.map((row) => row.beatmapId))].sort((a, b) => a - b);
