/**
 * @file src/services/built-pack-sync.ts
 * @desc Keeping a built pool's pack on packs in step with the pool. A change to an unlisted or
 *       public pool marks its pack pending (markPackPending, src/services/built-pools.ts); a sync
 *       first claims the pool with one guarded write that stamps `pack.lastAttemptAt`, so a pool
 *       syncs at most once every 30 s across every instance ("Update pack now" skips the wait,
 *       never the other rules). Then: an empty pool sends nothing (a pack it had is removed);
 *       anything else is PUT to packs with the owner's and editors' names. The answer is stored
 *       only if the pool didn't change meanwhile (a change marked it pending again, and the next
 *       sync sends it); a 410 is stored anyway and ends syncing for that pool. A pool that went
 *       private or was deleted while its PUT was out loses the pack it just got. Every run also
 *       retries due pack removals (retryDuePackCleanup). packs not set up here leaves pools
 *       pending. Never throws for packs; the database can.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

import "server-only";
import { getPacksService, type PacksService } from "@/env";
import type { SessionUser } from "@/lib/auth";
import { type Fetch, putPoolPack } from "@/lib/packs-client";
import { builtPoolsCollection } from "@/models/BuiltPool";
import type { StoredBuiltPool } from "@/schemas/built-pool";
import {
  type Answer,
  type BuiltPoolView,
  findBuiltPool,
  loadFor,
  NOT_FOUND,
  ownerOf,
  readBuiltPool,
  refuse,
  viewOf,
} from "@/services/built-pools";
import { removePackOrQueue, retryDuePackCleanup } from "@/services/pack-cleanup";
import {
  builtPackInput,
  EMPTY_BUILT_PACK,
  nextBuiltPack,
  PACK_GONE,
  PACK_SYNC_INTERVAL_MS,
} from "@/utils/built-pack";

export type PackSyncOptions = {
  /** "Update pack now": don't wait out the 30 s. */
  force?: boolean;
  /** Retry due pack removals too (default true; "Update pack now" runs them after its answer). */
  retryCleanup?: boolean;
  fetch?: Fetch;
  now?: () => Date;
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

/** Takes the pool for one sync, or null when it's not due (or not there). */
const claim = async (id: string, at: Date, force: boolean): Promise<StoredBuiltPool | null> => {
  const since = new Date(at.getTime() - PACK_SYNC_INTERVAL_MS);
  const due = force
    ? {}
    : {
        "pack.state": { $in: ["pending", "failed"] },
        $or: [{ "pack.lastAttemptAt": null }, { "pack.lastAttemptAt": { $lte: since } }],
      };
  const row = await (await builtPoolsCollection()).findOneAndUpdate(
    { _id: id, visibility: { $ne: "private" }, "pack.gone": { $ne: true }, ...due },
    { $set: { "pack.lastAttemptAt": at } },
    { returnDocument: "after" },
  );
  return readBuiltPool(row);
};

/** Stores the pack unless the pool changed since the claim; true when it was stored. */
const storeIfUnchanged = async (pool: StoredBuiltPool, pack: StoredBuiltPool["pack"]) =>
  (
    await (
      await builtPoolsCollection()
    ).updateOne({ _id: pool._id, version: pool.version }, { $set: { pack } })
  ).matchedCount === 1;

const namesOf = async (pool: StoredBuiltPool): Promise<string[]> => {
  const owner = await ownerOf(pool.ownerId);
  return [...(owner ? [owner.username] : []), ...pool.editors.map((editor) => editor.username)];
};

/** An empty pool has no pack: one it had is removed (or queued), and it's none again. */
const syncEmpty = async (pool: StoredBuiltPool, at: Date): Promise<void> => {
  if (pool.pack.slug !== null) await removePackOrQueue(pool, at);
  await storeIfUnchanged(pool, { ...EMPTY_BUILT_PACK, lastAttemptAt: pool.pack.lastAttemptAt });
};

/**
 * The pool changed while packs made its pack: one that went private or was deleted loses the
 * pack again; otherwise the pack's slug is kept and the pool stays pending for the next sync.
 */
const afterChange = async (id: string, pack: StoredBuiltPool["pack"], at: Date) => {
  const current = await findBuiltPool(id);
  if (!current || current.visibility === "private") {
    await removePackOrQueue({ _id: id, pack }, at);
    return;
  }
  await (await builtPoolsCollection()).updateOne(
    { _id: id, visibility: { $ne: "private" } },
    {
      $set: { "pack.slug": pack.slug, "pack.listed": pack.listed, "pack.syncedAt": pack.syncedAt },
    },
  );
};

/**
 * @function syncBuiltPack
 * @param id {string} a built pool id
 * @param options {PackSyncOptions} skip the 30 s wait, and fetch and the clock (tests)
 * @returns {Promise<boolean>} true when a sync ran (the pool was due and packs is set up here)
 */
export const syncBuiltPack = async (
  id: string,
  { force = false, retryCleanup = true, fetch, now = () => new Date() }: PackSyncOptions = {},
): Promise<boolean> => {
  const service = packsService();
  if (!service) return false;
  const at = now();
  const pool = await claim(id, at, force);
  if (!pool) return false;
  if (pool.slots.length === 0) {
    await syncEmpty(pool, at);
  } else {
    const input = builtPackInput(pool, await namesOf(pool));
    const answer = await putPoolPack(service, id, input, fetch ? { fetch } : {});
    if (answer.kind === "config") console.error(`[packs] ${id}'s pack: ${answer.message}`);
    const pack = nextBuiltPack(pool.pack, answer, now());
    if (answer.kind === "gone") {
      await (await builtPoolsCollection()).updateOne({ _id: id }, { $set: { pack } });
    } else if (!(await storeIfUnchanged(pool, pack)) && answer.kind === "ok") {
      await afterChange(id, pack, at);
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
 *          (its pack synced, or failed with the reason); 400 for a private or empty pool or one
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
