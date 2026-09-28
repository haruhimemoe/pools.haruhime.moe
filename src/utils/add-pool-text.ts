/**
 * @file src/utils/add-pool-text.ts
 * @desc What the admin's add-a-pool form says after a save: the pool was added, or its maps are
 *       already in a pool the source joined (back from superseded, maybe) or that already
 *       credits the sender, and what happened to its pack. Pure.
 * @author David @dvhsh (https://dvh.sh)
 * @created Fri Sep 25, 2026
 * @modified Mon Sep 28, 2026
 */

import type { SyncState } from "@/schemas/pool";

/** What happened to the pack after the add. */
export type AddPoolSync =
  | { status: "not-needed" }
  | { status: "sent"; state: SyncState; error: string | null }
  | { status: "failed"; message: string };

/** POST /api/admin/pools' answer, as the form reads it. */
export type AddPoolAnswer = {
  outcome: "created" | "merged";
  revived: boolean;
  alreadyCredited: boolean;
  pool: { id: string; name: string; href: string };
  sync: AddPoolSync;
};

/**
 * @function syncText
 * @param sync {AddPoolSync} what happened to the pack
 * @returns {string} that, as a sentence
 */
export const syncText = (sync: AddPoolSync): string => {
  if (sync.status === "not-needed") return "Its pack didn't need an update.";
  if (sync.status === "failed") return `The pack wasn't sent: ${sync.message}`;
  if (sync.state === "error") return `packs didn't take the pack: ${sync.error ?? "no answer"}`;
  if (sync.state === "rejected") return `packs refused the pack: ${sync.error ?? ""}`;
  return sync.state === "created" ? "packs made its pack." : "packs updated its pack.";
};

/**
 * What happened, after the pool's name (which the form links).
 * @function outcomeText
 * @param answer {AddPoolAnswer} the route's answer
 * @returns {{ before: string; after: string }} the text around the pool's link
 */
export const outcomeText = (answer: AddPoolAnswer): { before: string; after: string } => {
  if (answer.outcome === "created")
    return { before: "Added ", after: `. ${syncText(answer.sync)}` };
  if (answer.alreadyCredited)
    return {
      before: "These maps are already in ",
      after: ", which already credits this sender with this link, so nothing was added.",
    };
  const back = answer.revived ? " and it's back from superseded" : "";
  return {
    before: "These maps are already in ",
    after: `, so the source joined it${back}. Its name, round, year and notes stay as they were: edit them there. ${syncText(answer.sync)}`,
  };
};
