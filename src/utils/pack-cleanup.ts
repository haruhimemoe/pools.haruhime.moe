/**
 * @file src/utils/pack-cleanup.ts
 * @desc Pack removals packs couldn't do yet (pack_cleanup): when one is tried again (5 minutes
 *       after the first failure, doubling with each, at most 6 hours apart), the shape of a
 *       retry's summary, and what it says to an admin. Pure.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

export const CLEANUP_FIRST_WAIT_MS = 5 * 60_000;
export const CLEANUP_MAX_WAIT_MS = 6 * 60 * 60_000;

/** One queued removal: packs' ref (the pool id), why the last try failed, tries so far. */
export type PackCleanupEntry = {
  _id: string;
  ref: string;
  reason: string;
  attempts: number;
  nextAt: Date;
  queuedAt: Date;
};

export type PackCleanupSummary = {
  /** Entries this run looked at. */
  due: number;
  removed: number;
  /** Still failing: tried again later. */
  failed: number;
  /** Their pool wants a pack again (it isn't private any more): dropped, not removed. */
  kept: number;
  /** Entries left in the queue after the run. */
  remaining: number;
  /** packs isn't set up or refused the token: nothing more was tried. */
  configError: string | null;
};

/**
 * @function nextCleanupAt
 * @param attempts {number} failed tries so far (1 after the first)
 * @param now {Date} when the last one failed
 * @returns {Date} when to try again: 5 minutes, doubling per failure, at most 6 hours
 */
export const nextCleanupAt = (attempts: number, now: Date): Date => {
  const doublings = Math.min(Math.max(attempts, 1) - 1, 16);
  const wait = Math.min(CLEANUP_FIRST_WAIT_MS * 2 ** doublings, CLEANUP_MAX_WAIT_MS);
  return new Date(now.getTime() + wait);
};

const plural = (count: number, one: string, many: string): string =>
  `${count} ${count === 1 ? one : many}`;

/**
 * @function cleanupSummaryText
 * @param summary {PackCleanupSummary} a retry's summary
 * @returns {string} what it did, for the admin page
 */
export const cleanupSummaryText = (summary: PackCleanupSummary): string => {
  const waiting = summary.remaining > 0 ? ` ${summary.remaining} waiting.` : "";
  if (summary.configError) return `Nothing tried: ${summary.configError}${waiting}`;
  if (summary.due === 0) return "No pack removals were waiting.";
  const parts = [
    summary.removed > 0 ? `Removed ${plural(summary.removed, "pack", "packs")}.` : "",
    summary.kept === 1 ? "1 pool wanted its pack again, so it stays." : "",
    summary.kept > 1 ? `${summary.kept} pools wanted their packs again, so they stay.` : "",
    summary.failed > 0
      ? `${plural(summary.failed, "removal still fails", "removals still fail")};${waiting}`
      : "",
  ].filter(Boolean);
  const text = parts.join(" ");
  return summary.failed > 0 ? text : `${text}${waiting}`;
};
