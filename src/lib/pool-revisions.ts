/**
 * @file src/lib/pool-revisions.ts
 * @desc built_pools' history: next-kit's revision store over pool_revisions, one line of
 *       snapshots per pool (src/utils/pool-snapshot.ts). Nothing connects at import.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Oct 5, 2026
 * @modified Mon Oct 5, 2026
 */

import "server-only";
import { createRevisionStore } from "@haruhimemoe/next-kit/vcs";
import { POOL_REVISIONS_COLLECTION } from "@/constants/db";
import { connectedDb } from "@/lib/db";
import { POOL_CODEC, type PoolSnapshot } from "@/utils/pool-snapshot";

/** Every built pool's revisions. */
export const poolRevisions = createRevisionStore<PoolSnapshot>({
  db: connectedDb,
  collection: POOL_REVISIONS_COLLECTION,
  codec: POOL_CODEC,
});
