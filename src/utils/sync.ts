/**
 * @file src/utils/sync.ts
 * @desc Pack sync rules: what a PUT to packs comes back as (ok, rejected, gone, error, config),
 *       which pools are due (never gone ones; error ones always; rejected ones only when their
 *       input changed or on request; the rest when their input hash differs from the last one
 *       packs answered definitively), the pack state after an answer (the hash moves only on a
 *       definitive answer: ok or rejected), and the shapes of a sync and a stats backfill
 *       summary. Pure.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { type PackSync, SYNC_STATES, type SyncState } from "@/schemas/pool";

export type SyncAnswer =
  | { kind: "ok"; slug: string; state: "created" | "updated" | "unchanged"; listed: boolean }
  | { kind: "rejected"; status: number; message: string }
  | { kind: "gone" }
  | { kind: "error"; message: string; retryAfterMs: number | null }
  | { kind: "config"; message: string };

export type SyncSummary = {
  due: number;
  sent: number;
  states: Record<SyncState, number>;
  /** Due pools not sent (the limit, or a configuration stop). */
  remaining: number;
  configError: string | null;
};

export type BackfillResult = {
  calls: number;
  updated: number;
  remaining: number | null;
  stopped: "done" | "no-progress" | "limit" | "config";
  message: string | null;
};

/**
 * @function needsSync
 * @param pack {PackSync} the pool's sync state
 * @param hash {string} its current input hash
 * @param options {{ resyncRejected?: boolean }} send rejected pools even when unchanged
 * @returns {boolean} whether the pool is due
 */
export const needsSync = (
  pack: PackSync,
  hash: string,
  { resyncRejected = false }: { resyncRejected?: boolean } = {},
): boolean => {
  if (pack.state === "gone") return false;
  if (pack.state === "error") return true;
  if (pack.state === "rejected") return resyncRejected || hash !== pack.inputHash;
  return hash !== pack.inputHash;
};

/**
 * @function nextPackSync
 * @param previous {PackSync} the state before the request
 * @param answer {Exclude<SyncAnswer, { kind: "config" }>} what packs said
 * @param hash {string} the input hash the request carried
 * @param now {Date} when the answer came
 * @returns {PackSync & { state: SyncState }} the state to store
 */
export const nextPackSync = (
  previous: PackSync,
  answer: Exclude<SyncAnswer, { kind: "config" }>,
  hash: string,
  now: Date,
): PackSync & { state: SyncState } => {
  switch (answer.kind) {
    case "ok":
      return {
        slug: answer.slug,
        state: answer.state,
        listed: answer.listed,
        inputHash: hash,
        syncedAt: now,
        error: null,
      };
    case "rejected":
      return {
        ...previous,
        state: "rejected",
        inputHash: hash,
        syncedAt: now,
        error: `packs refused it (${answer.status}): ${answer.message}`,
      };
    case "gone":
      return { ...previous, state: "gone", listed: false, syncedAt: now, error: null };
    case "error":
      return { ...previous, state: "error", error: answer.message };
  }
};

/**
 * @function emptySyncStates
 * @returns {Record<SyncState, number>} every state counted 0
 */
export const emptySyncStates = (): Record<SyncState, number> =>
  Object.fromEntries(SYNC_STATES.map((state) => [state, 0])) as Record<SyncState, number>;
