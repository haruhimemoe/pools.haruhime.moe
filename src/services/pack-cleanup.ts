/**
 * @file src/services/pack-cleanup.ts
 * @desc Removing a built pool's pack on packs without ever blocking the person who asked. A pool
 *       going private, a deleted pool and a deleted account try packs once; when packs is down,
 *       refuses or isn't set up here, the removal goes into pack_cleanup (`{ ref, reason,
 *       attempts, nextAt }`, one row per ref) and the person's action goes ahead. The queue is
 *       retried on every packs sync run (the due rows) and from /admin's "Retry pack cleanup"
 *       (every row): a row packs removes is dropped, one still failing waits longer
 *       (src/utils/pack-cleanup.ts), a row whose pool isn't private any more (and has maps) is
 *       dropped without a call (the pool wants its pack again, and sync takes over), one whose
 *       pool wanted its pack again by the time packs removed it is marked pending (a sync may
 *       have made it meanwhile), and a configuration answer or two failures in a row stop the
 *       run (each try can take 15 s). Built pool ids are never reused, so a ref only ever names
 *       one pool.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Mon Sep 28, 2026
 */

import "server-only";
import type { Collection } from "mongodb";
import { PACK_CLEANUP_COLLECTION } from "@/constants/db";
import { getPacksService, type PacksService } from "@/env";
import { connectedDb } from "@/lib/db";
import { deletePack, type Fetch } from "@/lib/packs-client";
import { builtPoolsCollection } from "@/models/BuiltPool";
import type { StoredBuiltPool } from "@/schemas/built-pool";
import {
  nextCleanupAt,
  type PackCleanupEntry,
  type PackCleanupSummary,
} from "@/utils/pack-cleanup";

/** Rows one sync run retries on the side. */
export const CLEANUP_PER_SYNC = 10;
/** Rows one admin retry takes. */
export const CLEANUP_PER_RETRY = 50;
/** Failures in a row that end a retry run: packs looks down, and each try can take 15 s. */
export const CLEANUP_MAX_FAILURES_IN_A_ROW = 2;

/**
 * @function packCleanupCollection
 * @returns {Promise<Collection<PackCleanupEntry>>} pack_cleanup once connected
 */
export const packCleanupCollection = async (): Promise<Collection<PackCleanupEntry>> =>
  (await connectedDb()).collection<PackCleanupEntry>(PACK_CLEANUP_COLLECTION);

/** packs' address and token, or why there are none. */
const packsOrReason = (): PacksService | string => {
  try {
    return getPacksService() ?? "packs isn't set up here.";
  } catch (error) {
    return error instanceof Error ? error.message : "packs isn't set up here.";
  }
};

/**
 * @function queuePackRemoval
 * @param ref {string} the pool id (packs' ref for its pack)
 * @param reason {string} why the removal failed
 * @param now {Date} when
 * @returns {Promise<void>} the row added (or, already there, counted once more and due soon)
 */
export const queuePackRemoval = async (ref: string, reason: string, now: Date): Promise<void> => {
  await (await packCleanupCollection()).updateOne(
    { _id: ref },
    {
      $set: { ref, reason, nextAt: nextCleanupAt(1, now) },
      $inc: { attempts: 1 },
      $setOnInsert: { queuedAt: now },
    },
    { upsert: true },
  );
};

/** What happened to a pack: none to remove, removed, or queued. */
export type PackRemoval = "none" | "removed" | "queued";

/**
 * @function removePackOrQueue
 * @param pool {Pick<StoredBuiltPool, "_id" | "pack">} a pool losing its pack
 * @param now {Date} current time (tests)
 * @param reasonIfSkipped {string | null} queue without asking packs, with this reason (packs
 *        already failed for an earlier pool in the same request)
 * @returns {Promise<PackRemoval>} "none" (it had no pack), "removed", or "queued" for later
 */
export const removePackOrQueue = async (
  pool: Pick<StoredBuiltPool, "_id" | "pack">,
  now: Date = new Date(),
  reasonIfSkipped: string | null = null,
): Promise<PackRemoval> => {
  if (pool.pack.state === "none") return "none";
  const service = reasonIfSkipped ?? packsOrReason();
  if (typeof service !== "string") {
    const answer = await deletePack(service, pool._id);
    if (answer.kind === "ok") return "removed";
    await queuePackRemoval(pool._id, answer.message, now);
    return "queued";
  }
  await queuePackRemoval(pool._id, service, now);
  return "queued";
};

/** True when the ref's pool still exists, isn't private and has maps: it wants its pack again. */
const wantsPack = async (ref: string): Promise<boolean> => {
  const pool = await (await builtPoolsCollection()).findOne(
    { _id: ref },
    { projection: { visibility: 1, "slots.beatmapId": 1 } },
  );
  return pool !== null && pool.visibility !== "private" && pool.slots.length > 0;
};

/**
 * A sync may have made the pack again between wantsPack and the DELETE (the pool went unlisted
 * meanwhile): a pool that wants its pack after the DELETE is marked pending, so the next sync
 * sends it again.
 */
const pendingIfWanted = async (ref: string): Promise<void> => {
  await (await builtPoolsCollection()).updateOne(
    {
      _id: ref,
      visibility: { $ne: "private" },
      "pack.gone": { $ne: true },
      "slots.0": { $exists: true },
    },
    { $set: { "pack.state": "pending" } },
  );
};

/**
 * @function retryPackCleanup
 * @param service {PacksService} packs' address and token
 * @param options {{ all?: boolean; limit?: number; fetch?: Fetch; now?: () => Date }} every
 *        row instead of the due ones, how many, and fetch and the clock (tests)
 * @returns {Promise<PackCleanupSummary>} what was tried and what's left
 */
export const retryPackCleanup = async (
  service: PacksService,
  {
    all = false,
    limit = CLEANUP_PER_RETRY,
    fetch,
    now = () => new Date(),
  }: { all?: boolean; limit?: number; fetch?: Fetch; now?: () => Date } = {},
): Promise<PackCleanupSummary> => {
  const entries = await packCleanupCollection();
  const rows = await entries
    .find(all ? {} : { nextAt: { $lte: now() } })
    .sort({ nextAt: 1, _id: 1 })
    .limit(limit)
    .toArray();
  const summary: PackCleanupSummary = {
    due: rows.length,
    removed: 0,
    failed: 0,
    kept: 0,
    remaining: 0,
    configError: null,
  };
  let failuresInARow = 0;
  for (const row of rows) {
    if (failuresInARow >= CLEANUP_MAX_FAILURES_IN_A_ROW) break;
    if (await wantsPack(row.ref)) {
      await entries.deleteOne({ _id: row._id });
      summary.kept += 1;
      continue;
    }
    const answer = await deletePack(service, row.ref, fetch ? { fetch } : {});
    if (answer.kind === "config") {
      summary.configError = answer.message;
      break;
    }
    if (answer.kind === "ok") {
      await pendingIfWanted(row.ref);
      await entries.deleteOne({ _id: row._id });
      summary.removed += 1;
      failuresInARow = 0;
      continue;
    }
    failuresInARow += 1;
    const attempts = row.attempts + 1;
    await entries.updateOne(
      { _id: row._id },
      { $set: { reason: answer.message, attempts, nextAt: nextCleanupAt(attempts, now()) } },
    );
    summary.failed += 1;
  }
  summary.remaining = await entries.countDocuments();
  return summary;
};

/**
 * @function retryDuePackCleanup
 * @param service {PacksService} packs' address and token
 * @param options {{ fetch?: Fetch; now?: () => Date }} fetch and the clock (tests)
 * @returns {Promise<void>} up to 10 due removals tried, on the side of a sync run (a failure is
 *          logged, never thrown: the sync itself must not fail over it)
 */
export const retryDuePackCleanup = async (
  service: PacksService,
  options: { fetch?: Fetch; now?: () => Date } = {},
): Promise<void> => {
  try {
    await retryPackCleanup(service, { ...options, limit: CLEANUP_PER_SYNC });
  } catch (error) {
    console.error("[packs] couldn't retry the queued pack removals", error);
  }
};

/**
 * @function countPackCleanup
 * @returns {Promise<number>} pack removals still waiting (the admin page)
 */
export const countPackCleanup = async (): Promise<number> =>
  (await packCleanupCollection()).countDocuments();
