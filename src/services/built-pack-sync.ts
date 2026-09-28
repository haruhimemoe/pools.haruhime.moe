/**
 * @file src/services/built-pack-sync.ts
 * @desc Keeping a built pool's pack on packs in step with the pool. A change to an unlisted or
 *       public pool marks its pack pending (markPackPending, src/services/built-pools.ts); a sync
 *       first claims the pool with one guarded write that stamps `pack.lastAttemptAt`, so a pool
 *       syncs at most once every 30 s across every instance. "Update pack now" and an admin's
 *       hide skip the 30 s but never overlap a claim younger than the PUT timeout: they wait it
 *       out once, and leave the pool pending when another claim came meanwhile. Then: an empty
 *       pool sends nothing (a pack it had, or may have had, is removed); anything else is PUT to
 *       packs with the owner's and editors' names. Every write after the PUT holds to its claim:
 *       the answer is stored only if the pool didn't change and no newer sync claimed it; a pool
 *       that changed keeps the pack's slug and stays pending; one a newer sync claimed takes
 *       nothing from the answer and is pending again, so the current state is sent again; a 410
 *       is stored anyway and ends syncing for that pool. A pool that went private or was
 *       deleted while its PUT was out loses the pack it just got. Every run also retries due
 *       pack removals (retryDuePackCleanup). packs not set up here leaves pools pending. Never
 *       throws for packs; the database can.
 *       The claim and the guarded writes are src/services/built-pack-claims.ts.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Mon Sep 28, 2026
 */

import "server-only";
import { getPacksService, type PacksService } from "@/env";
import { type Fetch, putPoolPack } from "@/lib/packs-client";
import { builtPoolsCollection } from "@/models/BuiltPool";
import type { StoredBuiltPool } from "@/schemas/built-pool";
import type { SessionUser } from "@/schemas/session-user";
import { claimAt, claimForced, sleep, storeIfUnchanged } from "@/services/built-pack-claims";
import { findBuiltPool, loadFor, ownerOf, viewOf } from "@/services/built-pool-read";
import { removePackOrQueue, retryDuePackCleanup } from "@/services/pack-cleanup";
import { type Answer, type BuiltPoolView, NOT_FOUND, refuse } from "@/utils/built-answer";
import { builtPackInput, EMPTY_BUILT_PACK, nextBuiltPack, PACK_GONE } from "@/utils/built-pack";

export type PackSyncOptions = {
  /** "Update pack now": don't wait out the 30 s. */
  force?: boolean;
  /** Retry due pack removals too (default true; "Update pack now" runs them after its answer). */
  retryCleanup?: boolean;
  fetch?: Fetch;
  now?: () => Date;
  /** How a forced sync waits for a sync still out (tests). */
  wait?: (ms: number) => Promise<void>;
};

/**
 * @function packsService
 * @returns {PacksService | null} packs' address and token, or null when packs isn't set up here
 *          (settings that are wrong are logged, never printed)
 */
export const packsService = (): PacksService | null => {
  try {
    return getPacksService();
  } catch (error) {
    console.error(
      "[packs] the packs settings are wrong",
      error instanceof Error ? error.message : "",
    );
    return null;
  }
};

/** A regular claim at `at`: due (pending, or failed and worth trying again), 30 s since the last. */

/** The pool as the claim at `at` left it: the same version, and no newer claim since. */

/** Stores the pack unless the pool changed or a newer sync claimed it; true when stored. */

const namesOf = async (pool: StoredBuiltPool): Promise<string[]> => {
  const owner = await ownerOf(pool.ownerId);
  return [...(owner ? [owner.username] : []), ...pool.editors.map((editor) => editor.username)];
};

/**
 * An empty pool has no pack: one it had, or may have had (a first PUT that failed on our side
 * could still have made it), is removed (or queued), and it's none again.
 */
const syncEmpty = async (pool: StoredBuiltPool, at: Date): Promise<void> => {
  if (pool.pack.state !== "none") await removePackOrQueue(pool, at);
  await storeIfUnchanged(pool, at, { ...EMPTY_BUILT_PACK, lastAttemptAt: at });
};

/**
 * packs made the pack, but the answer couldn't be stored. A pool that went private or was
 * deleted loses the pack again. One that changed keeps the pack's slug and stays pending for the
 * next sync. One a newer sync claimed meanwhile takes nothing from this answer (packs may have
 * applied it after the newer one) and is pending again, so the current state is sent again.
 */
const afterChange = async (pool: StoredBuiltPool, at: Date, pack: StoredBuiltPool["pack"]) => {
  const current = await findBuiltPool(pool._id);
  if (!current || current.visibility === "private") {
    await removePackOrQueue({ _id: pool._id, pack }, at);
    return;
  }
  const pools = await builtPoolsCollection();
  const shared = { _id: pool._id, visibility: { $ne: "private" as const } };
  const { slug, listed, syncedAt } = pack;
  const kept = await pools.updateOne(
    { ...shared, "pack.lastAttemptAt": at },
    {
      $set: {
        "pack.slug": slug,
        "pack.listed": listed,
        "pack.syncedAt": syncedAt,
        "pack.state": "pending",
      },
    },
  );
  if (kept.matchedCount === 1) return;
  await pools.updateOne(
    { ...shared, "pack.gone": { $ne: true } },
    { $set: { "pack.state": "pending" } },
  );
};

/** packs removed the pack (410): whatever claim is newest, the pool never syncs again. */

const storeGone = async (id: string, pack: StoredBuiltPool["pack"]) => {
  const { state, error, listed, gone } = pack;
  await (await builtPoolsCollection()).updateOne(
    { _id: id },
    {
      $set: { "pack.state": state, "pack.error": error, "pack.listed": listed, "pack.gone": gone },
    },
  );
};

/**
 * @function syncBuiltPack
 * @param id {string} a built pool id
 * @param options {PackSyncOptions} skip the 30 s wait, and fetch, the clock and the wait for a
 *        sync still out (tests)
 * @returns {Promise<boolean>} true when a sync ran (the pool was due and packs is set up here);
 *          false for a forced sync that found another still out and left the pool pending
 */
export const syncBuiltPack = async (
  id: string,
  {
    force = false,
    retryCleanup = true,
    fetch,
    now = () => new Date(),
    wait = sleep,
  }: PackSyncOptions = {},
): Promise<boolean> => {
  const service = packsService();
  if (!service) return false;
  const claimed = force ? await claimForced(id, now, wait) : await claimAt(id, now());
  if (!claimed) return false;
  const { pool, at } = claimed;
  if (pool.slots.length === 0) {
    await syncEmpty(pool, at);
  } else {
    const input = builtPackInput(pool, await namesOf(pool));
    const answer = await putPoolPack(service, id, input, fetch ? { fetch } : {});
    if (answer.kind === "config") console.error(`[packs] ${id}'s pack: ${answer.message}`);
    const pack = nextBuiltPack(pool.pack, answer, now());
    if (answer.kind === "gone") {
      await storeGone(id, pack);
    } else if (!(await storeIfUnchanged(pool, at, pack)) && answer.kind === "ok") {
      await afterChange(pool, at, pack);
    }
  }
  if (retryCleanup) await retryDuePackCleanup(service, { ...(fetch ? { fetch } : {}), now });
  return true;
};

/**
 * @function updatePackNow
 * @param id {string} an untrusted built pool id
 * @param caller {SessionUser} the owner or an editor
 * @param options {PackSyncOptions} fetch and the clock (tests)
 * @returns {Promise<Answer<BuiltPoolView>>} the pool after a sync that didn't wait out the 30 s
 *          (its pack synced, or failed with the reason; pending when another sync was still out
 *          after waiting up to the PUT timeout for it); 400 for a private or empty pool or one
 *          packs removed; 503 when packs isn't set up here
 */
export const updatePackNow = async (
  id: string,
  caller: SessionUser,
  options: Pick<PackSyncOptions, "fetch" | "now"> = {},
): Promise<Answer<BuiltPoolView>> => {
  const loaded = await loadFor(id, caller, (access) => access.canEdit);
  if (!loaded.ok) return loaded;
  const { pool } = loaded.value;
  if (pool.visibility === "private") {
    return refuse(400, "private", "A private pool has no pack. Make it unlisted or public first.");
  }
  if (pool.pack.gone) return refuse(400, "pack_gone", PACK_GONE);
  if (pool.slots.length === 0) return refuse(400, "empty", "Add a map first: a pack needs one.");
  if (!packsService()) return refuse(503, "packs_unavailable", "packs isn't set up here.");
  await syncBuiltPack(id, { ...options, force: true, retryCleanup: false });
  const after = await findBuiltPool(id);
  if (!after) return refuse(404, "not_found", NOT_FOUND);
  return { ok: true, value: await viewOf(after, caller) };
};
