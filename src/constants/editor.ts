/**
 * @file src/constants/editor.ts
 * @desc The pool editor's poll interval and what it says when a change can't stand: someone
 *       else's change, a deleted pool or lost access, an undo dropped or gone stale.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Mon Sep 28, 2026
 */

/** How often the editor asks for the pool's version. */
export const POLL_MS = 15_000;

/** Said when someone else's change replaced a queued one. */
export const CONFLICT =
  "Someone else changed this pool. It's reloaded; your last change wasn't saved.";

/** Said once when a read or a save meets a 404 or 401. */
export const GONE = "This pool was deleted or you no longer have access.";

/** Said when an undo met a 409. */
export const UNDO_DROPPED =
  "Someone else changed this pool since, so that undo was dropped. It's reloaded.";

/** Said when the step to undo no longer applies. */
export const UNDO_STALE = "The pool changed since, so that step can't be undone any more.";
