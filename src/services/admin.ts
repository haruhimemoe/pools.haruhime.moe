/**
 * @file src/services/admin.ts
 * @desc Admin work. A pool save stores only the edits that differ from the name and source notes,
 *       recomputes the effective fields, key, search text and visibility, rebuilds its maps'
 *       usage when hidden or year changed, and PUTs its pack at once when the pack input changed
 *       and packs hasn't deleted it (a failed PUT stays as error and the answer says so). badged
 *       for every pool of a tournament (one year, unknown years, or all). Retries for failed
 *       syncs, 50 pools at most per click, and for queued pack removals. Every change
 *       revalidates the public pages it touches. syncPoolNow sends one pool's pack at once (the
 *       edit and an added pool use it). The admin pool list is src/services/admin-pools.ts.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Mon Sep 28, 2026
 */

import "server-only";
import { EnvError } from "@haruhimemoe/next-kit/env";
import { BATCH_QUERY_MS, QUERY_TIME_MS } from "@/constants/db";
import { getPacksService, type PacksService } from "@/env";
import type { Fetch } from "@/lib/packs-client";
import { revalidateAllPoolAndMapPages, revalidatePoolPages } from "@/lib/revalidate";
import { poolsCollection } from "@/models/Pool";
import type { BadgedBody, PoolEditBody } from "@/schemas/admin";
import { parseStoredPool, type StoredPool, SYNC_STATES, type SyncState } from "@/schemas/pool";
import { CLEANUP_PER_RETRY, countPackCleanup, retryPackCleanup } from "@/services/pack-cleanup";
import { syncPools } from "@/services/sync";
import { recomputeUsage } from "@/services/usage";
import type { PackCleanupSummary } from "@/utils/pack-cleanup";
import { packInputHash, packInputOf } from "@/utils/pack-input";
import { derivedFields, editsFrom, effectiveFields, isVisible } from "@/utils/pool-record";
import type { SyncSummary } from "@/utils/sync";

/** The packs service and the clock (tests). */
export type AdminDeps = {
  packsService?: () => PacksService | null;
  fetch?: Fetch;
  now?: () => Date;
};

/** What an admin save did to the pack: not needed, sent (with packs' answer), or failed. */
export type SyncOutcome =
  | { status: "not-needed" }
  | { status: "sent"; state: SyncState; error: string | null }
  | { status: "failed"; message: string };

const NO_TOKEN = "POOLS_SERVICE_TOKEN isn't set, so the pack wasn't updated.";

const serviceOrReason = (read: () => PacksService | null): PacksService | string => {
  try {
    return read() ?? NO_TOKEN;
  } catch (error) {
    if (error instanceof EnvError) return error.message;
    throw error;
  }
};

/**
 * @function syncPoolNow
 * @param pool {StoredPool} a pool as it now stands
 * @param deps {AdminDeps} packs service, fetch and clock (tests)
 * @returns {Promise<SyncOutcome>} not-needed when packs deleted its pack or its input didn't
 *          change; otherwise the PUT's outcome (its stored state), or why it wasn't sent
 */
export const syncPoolNow = async (
  pool: StoredPool,
  { packsService = getPacksService, fetch, now = () => new Date() }: AdminDeps = {},
): Promise<SyncOutcome> => {
  if (pool.pack.state === "gone" || packInputHash(packInputOf(pool)) === pool.pack.inputHash) {
    return { status: "not-needed" };
  }
  const service = serviceOrReason(packsService);
  if (typeof service === "string") return { status: "failed", message: service };
  const summary = await syncPools({ service, ids: [pool._id], fetch, now });
  if (summary.configError !== null) return { status: "failed", message: summary.configError };
  const after = await (await poolsCollection()).findOne(
    { _id: pool._id },
    { projection: { pack: 1 }, maxTimeMS: QUERY_TIME_MS },
  );
  return { status: "sent", state: after?.pack.state ?? "error", error: after?.pack.error ?? null };
};

/**
 * @function savePoolEdit
 * @param id {string} the pool id
 * @param body {PoolEditBody} the admin's form
 * @param deps {AdminDeps} packs service, fetch and clock (tests)
 * @returns {Promise<{ pool: StoredPool; sync: SyncOutcome } | null>} the saved pool and what
 *          happened to its pack, or null when there's no such pool
 */
export const savePoolEdit = async (
  id: string,
  body: PoolEditBody,
  { packsService = getPacksService, fetch, now = () => new Date() }: AdminDeps = {},
): Promise<{ pool: StoredPool; sync: SyncOutcome } | null> => {
  const pools = await poolsCollection();
  const before = parseStoredPool(await pools.findOne({ _id: id }, { maxTimeMS: QUERY_TIME_MS }));
  if (!before) return null;
  const edited = editsFrom(before.name, before.notes, body);
  const fields = effectiveFields(before.name, edited);
  const update = {
    edited,
    ...fields,
    ...derivedFields(before.name, fields),
    hidden: body.hidden,
    badged: body.badged,
    visible: isVisible({ hidden: body.hidden, supersededBy: before.supersededBy }),
    updatedAt: now(),
  };
  await pools.updateOne({ _id: id }, { $set: update });
  const saved: StoredPool = { ...before, ...update };
  const mapIds = [...new Set(before.slots.map((slot) => slot.beatmapId))];
  if (before.hidden !== saved.hidden || before.year !== saved.year) await recomputeUsage(mapIds);
  const sync = await syncPoolNow(saved, { packsService, fetch, now });
  revalidatePoolPages([id], mapIds);
  return {
    pool: parseStoredPool(await pools.findOne({ _id: id }, { maxTimeMS: QUERY_TIME_MS })) ?? saved,
    sync,
  };
};

/**
 * @function setBadged
 * @param body {BadgedBody} a tournament key, a year (null: unknown years; "all"), and badged
 * @param deps {AdminDeps} clock (tests)
 * @returns {Promise<{ matched: number }>} how many pools it set (badged never reaches packs)
 */
export const setBadged = async (
  { tournamentKey, year, badged }: BadgedBody,
  { now = () => new Date() }: AdminDeps = {},
): Promise<{ matched: number }> => {
  const pools = await poolsCollection();
  const result = await pools.updateMany(
    { tournamentKey, ...(year === "all" ? {} : { year }) },
    { $set: { badged, updatedAt: now() } },
  );
  revalidateAllPoolAndMapPages();
  return { matched: result.matchedCount };
};

/** Pools one retry click sends at most (a function has a minute). */
export const RETRY_LIMIT = 50;

/**
 * @function retrySyncs
 * @param options {{ includeRejected: boolean }} also send pools packs rejected
 * @param deps {AdminDeps} packs service, fetch and clock (tests)
 * @returns {Promise<SyncSummary>} what was sent and what's left
 */
export const retrySyncs = async (
  { includeRejected }: { includeRejected: boolean },
  { packsService = getPacksService, fetch, now = () => new Date() }: AdminDeps = {},
): Promise<SyncSummary> => {
  const states: SyncState[] = includeRejected ? ["error", "rejected"] : ["error"];
  const service = serviceOrReason(packsService);
  const pools = await poolsCollection();
  const ids = (
    await pools
      .find(
        { "pack.state": { $in: states } },
        { projection: { _id: 1 }, maxTimeMS: BATCH_QUERY_MS },
      )
      .toArray()
  ).map((pool) => pool._id);
  if (typeof service === "string") {
    return {
      due: ids.length,
      sent: 0,
      states: Object.fromEntries(SYNC_STATES.map((state) => [state, 0])) as Record<
        SyncState,
        number
      >,
      remaining: ids.length,
      configError: service,
    };
  }
  const summary = await syncPools({
    service,
    ids,
    resyncRejected: includeRejected,
    limit: RETRY_LIMIT,
    fetch,
    now,
  });
  revalidateAllPoolAndMapPages();
  return summary;
};

/**
 * @function retryQueuedPackRemovals
 * @param deps {AdminDeps} packs service, fetch and clock (tests)
 * @returns {Promise<PackCleanupSummary>} every queued pack removal tried (50 at most), due or
 *          not; nothing tried, and why, when packs isn't set up here
 */
export const retryQueuedPackRemovals = async ({
  packsService = getPacksService,
  fetch,
  now = () => new Date(),
}: AdminDeps = {}): Promise<PackCleanupSummary> => {
  const service = serviceOrReason(packsService);
  if (typeof service === "string") {
    const waiting = await countPackCleanup();
    return {
      due: waiting,
      removed: 0,
      failed: 0,
      kept: 0,
      remaining: waiting,
      configError: service,
    };
  }
  return retryPackCleanup(service, {
    all: true,
    limit: CLEANUP_PER_RETRY,
    now,
    ...(fetch ? { fetch } : {}),
  });
};
