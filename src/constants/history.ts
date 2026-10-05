/**
 * @file src/constants/history.ts
 * @desc Labels for a built pool's history page: what each revision kind reads as in the list,
 *       and the page's other copy.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Oct 5, 2026
 * @modified Mon Oct 5, 2026
 */

import type { RevisionKind } from "@haruhimemoe/vcs";

/** What each revision kind reads as in a history list. */
export const REVISION_LABELS: Readonly<Record<RevisionKind, string>> = {
  root: "Started",
  save: "Saved",
  autosave: "Autosaved",
  merge: "Saved (merged)",
  revert: "Restored",
  fork: "Copied",
  pull: "Pulled",
};

/** History page copy. */
export const HISTORY_COPY = {
  privateTitle: "This history is private",
  privateBody: "Only the owner and editors can see it.",
  empty: "No changes since history started.",
  revertQuestion: "Restore the pool as it was here? It saves as a new change.",
  publicLabel: "Who can see this pool's history",
} as const;
