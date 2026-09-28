/**
 * @file src/lib/pack-sync-after.ts
 * @desc Syncing a built pool's pack after the answer has gone (Next.js `after`), so no one waits
 *       on packs: the routes that change a pool and the pages that show one call it. The sync
 *       itself decides whether the pool is due (src/services/built-pack-sync.ts); a failure is
 *       logged, never thrown.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

import "server-only";
import { after } from "next/server";
import { packsService, syncBuiltPack } from "@/services/built-pack-sync";
import { retryDuePackCleanup } from "@/services/pack-cleanup";

/**
 * @function schedulePackSync
 * @param id {string} a built pool id
 * @returns {void} the pool's pack synced after the response, when it's due
 */
export const schedulePackSync = (id: string): void => {
  after(async () => {
    try {
      await syncBuiltPack(id);
    } catch (error) {
      console.error(`[packs] couldn't sync ${id}'s pack`, error);
    }
  });
};

/**
 * @function scheduleCleanupRetry
 * @returns {void} due pack removals retried after the response ("Update pack now" syncs in the
 *          request and leaves these for after)
 */
export const scheduleCleanupRetry = (): void => {
  after(async () => {
    const service = packsService();
    if (service) await retryDuePackCleanup(service);
  });
};
