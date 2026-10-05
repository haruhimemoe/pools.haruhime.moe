/**
 * @file src/constants/candidates.ts
 * @desc A built pool's candidates: the maps a slot is still considering besides its pick. How many
 *       one slot and one pool may hold, how long a candidate's note can be (a slot note's length),
 *       what the candidate ops refuse with, what a drag refuses with, and what the "Your
 *       candidates" list pages and says. Candidates are for the owner and editors only; no
 *       public surface shows them.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Oct 5, 2026
 */

import { MAX_SLOT_NOTE_LENGTH } from "@/constants/targets";

/** Candidates one slot can hold. */
export const MAX_CANDIDATES = 10;

/** Candidates one pool can hold across its slots, so a pool's row stays small. */
export const MAX_POOL_CANDIDATES = 100;

/** A candidate's note, in characters (the same as a slot's note). */
export const MAX_CANDIDATE_NOTE_LENGTH = MAX_SLOT_NOTE_LENGTH;

/** What the candidate ops refuse with. */
export const CANDIDATE_MESSAGES = {
  full: `A slot can have at most ${MAX_CANDIDATES} candidates.`,
  poolFull: `A pool can have at most ${MAX_POOL_CANDIDATES} candidates.`,
  already: "That map is already a candidate for this slot.",
  isPick: "That map is this slot's pick.",
  unknown: "That candidate isn't there any more.",
  noPick: "This slot has no pick.",
  noSlot: "Maps with no slot can't have candidates.",
  sameBucket: "Candidates move only between slots of the same bucket.",
} as const;

/** Why a dragged candidate can't drop there (read out by the editor's live region). */
export const CANDIDATE_DRAG_TEXT = {
  otherBucket: "A candidate stays in its bucket.",
  noSlot: "Drop a candidate on a slot or a candidate list.",
} as const;

/** "Your candidates": rows per page and the longest text search. */
export const YOUR_CANDIDATES = { pageSize: 50, maxQuery: 100 } as const;

/** What the "Your candidates" source says. */
export const YOUR_CANDIDATES_TEXT = {
  signedOut: "Sign in to see the candidates from pools you own or edit.",
  empty: "No candidates yet. Add one from a search with Add as candidate.",
  failed: "Your candidates couldn't be loaded.",
  picksToo: "Include picks",
} as const;
