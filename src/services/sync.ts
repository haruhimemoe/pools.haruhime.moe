/**
 * @file src/services/sync.ts
 * @desc Syncs pools' packs: every due pool (src/utils/sync.ts), or only the ids given, at most 5
 *       requests in flight, each answer stored on its pool as it comes. A configuration answer
 *       (401, 503 not_configured) stops the phase: requests in flight finish, no new ones start,
 *       and the pools it hit keep their state. A 429 or 5xx with Retry-After holds every later
 *       request until then (at most a minute). A run that packs didn't refuse also retries up
 *       to 10 due pack removals from pack_cleanup (src/services/pack-cleanup.ts). Also the stats
 *       backfill loop: packs' stats
 *       endpoint about once a minute until nothing is left, 5 calls in a row update nothing
 *       (errors count), or packs refuses the token.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Mon Sep 28, 2026
 */

import "server-only";
import { BATCH_QUERY_MS } from "@/constants/db";
import type { PacksService } from "@/env";
import { type Fetch, postStatsBackfill, putPoolPack } from "@/lib/packs-client";
import { poolsCollection } from "@/models/Pool";
import { retryDuePackCleanup } from "@/services/pack-cleanup";
import { packInputHash, packInputOf } from "@/utils/pack-input";
import {
  type BackfillResult,
  emptySyncStates,
  needsSync,
  nextPackSync,
  type SyncSummary,
} from "@/utils/sync";
import { runPool } from "@/utils/task-pool";

/** Past pools sent to packs at once. */
export const SYNC_CONCURRENCY = 5;
/** The longest a Retry-After holds the rest of a run. */
export const MAX_RETRY_WAIT_MS = 60_000;
/** How long the stats backfill waits between batches. */
export const BACKFILL_INTERVAL_MS = 60_000;
/** Batches that update nothing before the backfill stops. */
export const BACKFILL_MAX_IDLE = 5;
/** About 8 hours at one call a minute: far past the 2.5 hours the otdb backlog needs. */
export const BACKFILL_MAX_CALLS = 500;

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Which pools, whether to resend rejected ones, the service and the clock (tests). */
export type SyncOptions = {
  service: PacksService;
  /** Only these pools (default: every pool). */
  ids?: readonly string[];
  resyncRejected?: boolean;
  /** Send at most this many. */
  limit?: number;
  fetch?: Fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => Date;
};

/**
 * @function syncPools
 * @param options {SyncOptions} packs' address and token, which pools, and the clock (tests)
 * @returns {Promise<SyncSummary>} due, sent, each answer's state, what's left, and a
 *          configuration error when packs refused the token
 */
export const syncPools = async ({
  service,
  ids,
  resyncRejected = false,
  limit,
  fetch,
  sleep = wait,
  now = () => new Date(),
}: SyncOptions): Promise<SyncSummary> => {
  const pools = await poolsCollection();
  const rows = await pools
    .find(ids === undefined ? {} : { _id: { $in: [...ids] } }, {
      sort: { _id: 1 },
      maxTimeMS: BATCH_QUERY_MS,
    })
    .toArray();
  const due = rows.flatMap((pool) => {
    const input = packInputOf(pool);
    const hash = packInputHash(input);
    return needsSync(pool.pack, hash, { resyncRejected }) ? [{ pool, input, hash }] : [];
  });
  const send = limit === undefined ? due : due.slice(0, limit);
  const summary: SyncSummary = {
    due: due.length,
    sent: 0,
    states: emptySyncStates(),
    remaining: due.length - send.length,
    configError: null,
  };
  let notBefore = 0;
  await runPool(send, SYNC_CONCURRENCY, async ({ pool, input, hash }) => {
    if (summary.configError !== null) return;
    const hold = notBefore - now().getTime();
    if (hold > 0) await sleep(hold);
    if (summary.configError !== null) return;
    const answer = await putPoolPack(service, pool._id, input, { fetch });
    if (answer.kind === "config") {
      summary.configError = answer.message;
      return;
    }
    if (answer.kind === "error" && answer.retryAfterMs !== null) {
      notBefore = Math.max(
        notBefore,
        now().getTime() + Math.min(answer.retryAfterMs, MAX_RETRY_WAIT_MS),
      );
    }
    const next = nextPackSync(pool.pack, answer, hash, now());
    await pools.updateOne({ _id: pool._id }, { $set: { pack: next } });
    summary.sent += 1;
    summary.states[next.state] += 1;
  });
  if (summary.configError !== null) summary.remaining = due.length - summary.sent;
  // Every run also retries a few pack removals packs couldn't do earlier.
  else await retryDuePackCleanup(service, { ...(fetch ? { fetch } : {}), now });
  return summary;
};

/**
 * @function runStatsBackfill
 * @param options {{ service: PacksService; fetch?: Fetch; sleep?: (ms: number) => Promise<void>;
 *        log?: (text: string) => void; intervalMs?: number; maxCalls?: number }} packs' address
 *        and token, and the waits and output (tests)
 * @returns {Promise<BackfillResult>} calls made, stats updated, what packs says is left, and
 *          why it stopped
 */
export const runStatsBackfill = async ({
  service,
  fetch,
  sleep = wait,
  log = () => {},
  intervalMs = BACKFILL_INTERVAL_MS,
  maxCalls = BACKFILL_MAX_CALLS,
}: {
  service: PacksService;
  fetch?: Fetch;
  sleep?: (ms: number) => Promise<void>;
  log?: (text: string) => void;
  intervalMs?: number;
  maxCalls?: number;
}): Promise<BackfillResult> => {
  let calls = 0;
  let updated = 0;
  let remaining: number | null = null;
  let idle = 0;
  for (;;) {
    const answer = await postStatsBackfill(service, { fetch });
    calls += 1;
    if (answer.kind === "config") {
      return { calls, updated, remaining, stopped: "config", message: answer.message };
    }
    if (answer.kind === "ok") {
      updated += answer.updated;
      remaining = answer.remaining;
      log(`Pack stats: ${answer.updated} updated, ${answer.remaining} left.`);
      if (answer.remaining === 0)
        return { calls, updated, remaining, stopped: "done", message: null };
      idle = answer.updated === 0 ? idle + 1 : 0;
    } else {
      idle += 1;
      log(`Pack stats: ${answer.message}`);
    }
    if (idle >= BACKFILL_MAX_IDLE) {
      return { calls, updated, remaining, stopped: "no-progress", message: null };
    }
    if (calls >= maxCalls) return { calls, updated, remaining, stopped: "limit", message: null };
    await sleep(intervalMs);
  }
};
