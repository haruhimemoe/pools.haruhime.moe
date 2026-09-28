/**
 * @file src/constants/activity.ts
 * @desc The built pools' activity log (built_pool_activity): what kinds of change it records,
 *       how many entries a pool keeps (the last 200, trimmed on every write), how long an entry
 *       lives (180 days, a TTL index), how many the editor shows, how long a summary can be, and
 *       the name that replaces a deleted account's.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

/** What an activity entry records: the first op of an ops call, or a setting. */
export const ACTIVITY_KINDS = [
  "details",
  "add",
  "remove",
  "move",
  "mods",
  "note",
  "target",
  "visibility",
  "editors",
  "owner",
] as const;
/** One of ACTIVITY_KINDS. */
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

/** Entries one pool keeps; older ones are trimmed when a new one is written. */
export const MAX_ACTIVITY_PER_POOL = 200;

/** An entry lives 180 days. */
export const ACTIVITY_TTL_SECONDS = 180 * 24 * 60 * 60;

/** "Recent changes" in the editor. */
export const RECENT_ACTIVITY = 20;

/** A summary's longest, in characters. */
export const MAX_SUMMARY_LENGTH = 300;

/** Who a deleted account's entries say made them. */
export const DELETED_USER = "deleted user";
