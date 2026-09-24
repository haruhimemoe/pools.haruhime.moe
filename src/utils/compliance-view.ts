/**
 * @file src/utils/compliance-view.ts
 * @desc How /check shows an answer: each map's verdict (its beatmapset's, "Not on osu!" for an id
 *       osu! doesn't know, "Couldn't check" for one it couldn't answer), the summary card (not
 *       allowed, then a closer look, then couldn't check, then all clear; a map osu! doesn't know
 *       needs a closer look), and a verdict's notes split into text and https links (never HTML).
 *       Pure, and safe in the browser.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import type { CheckResponse } from "@/schemas/compliance";

export const MISSING_TEXT = "Not on osu!";
export const UNCHECKED_TEXT = "Couldn't check";

export type RowTone = "ok" | "potential" | "disallowed" | "missing" | "unchecked";

export type RowVerdict = { tone: RowTone; text: string; notes: string | null; ranked: boolean };

/**
 * @function rowVerdict
 * @param result {CheckResponse} the answer
 * @param id {number} a beatmap id that was asked about
 * @returns {RowVerdict} its set's verdict, or why there is none
 */
export const rowVerdict = (result: CheckResponse, id: number): RowVerdict => {
  const set = result.sets.find((entry) => entry.beatmapIds.includes(id));
  if (set) {
    return { tone: set.status, text: set.text, notes: set.notes ?? null, ranked: set.ranked };
  }
  if (result.missing.includes(id)) {
    return { tone: "missing", text: MISSING_TEXT, notes: null, ranked: false };
  }
  return { tone: "unchecked", text: UNCHECKED_TEXT, notes: null, ranked: false };
};

export type CheckSummary = {
  tone: "disallowed" | "potential" | "unchecked" | "ok";
  headline: string;
  counts: { ok: number; potential: number; disallowed: number; unchecked: number };
};

const maps = (n: number): string => `${n} ${n === 1 ? "map" : "maps"}`;

/**
 * @function summarizeCheck
 * @param result {CheckResponse} the answer
 * @param ids {readonly number[]} the ids that were asked about
 * @returns {CheckSummary} the card's tone, headline and counts
 */
export const summarizeCheck = (result: CheckResponse, ids: readonly number[]): CheckSummary => {
  const counts = { ok: 0, potential: 0, disallowed: 0, unchecked: 0 };
  for (const id of ids) {
    const { tone } = rowVerdict(result, id);
    if (tone === "missing") counts.potential += 1;
    else counts[tone] += 1;
  }
  if (counts.disallowed > 0) {
    return {
      tone: "disallowed",
      headline: `${maps(counts.disallowed)} ${counts.disallowed === 1 ? "isn't" : "aren't"} allowed in officially supported tournaments.`,
      counts,
    };
  }
  if (counts.potential > 0) {
    return {
      tone: "potential",
      headline: `${maps(counts.potential)} ${counts.potential === 1 ? "needs" : "need"} a closer look.`,
      counts,
    };
  }
  if (counts.unchecked > 0) {
    return {
      tone: "unchecked",
      headline: `${maps(counts.unchecked)} couldn't be checked. Try again in a minute.`,
      counts,
    };
  }
  return {
    tone: "ok",
    headline: "Every map meets the content rules for officially supported tournaments.",
    counts,
  };
};

const MARKDOWN_LINK = /\[([^\]]+)\]\((https:\/\/[^)\s]+)\)/gu;

/** A piece of a verdict's notes: plain text, or an https link. */
export type NotePart = { text: string } | { text: string; href: string };

/**
 * @function noteParts
 * @param notes {string} a verdict's notes (may hold markdown links)
 * @returns {NotePart[]} text and https links, in order
 */
export const noteParts = (notes: string): NotePart[] => {
  const parts: NotePart[] = [];
  let at = 0;
  for (const match of notes.matchAll(MARKDOWN_LINK)) {
    const [whole, text, href] = match;
    if (match.index > at) parts.push({ text: notes.slice(at, match.index) });
    parts.push({ text: text ?? "", href: href ?? "" });
    at = match.index + whole.length;
  }
  if (at < notes.length) parts.push({ text: notes.slice(at) });
  return parts;
};
