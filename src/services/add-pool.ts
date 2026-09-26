/**
 * @file src/services/add-pool.ts
 * @desc An admin adds a host or community pool by hand, through the importer's own pipeline:
 *       the maps are read (src/utils/add-pool-input.ts) and normalized, the source gets a new
 *       generated id, and planImport decides. Maps no stored pool has make a new record
 *       "<kind>-<id>" named "<tournament> <year> <round>", with the typed fields as edits and
 *       badged; maps a stored record has add the source to it (a superseded one is revived) and
 *       change nothing else. Then maps pools never saw get blank rows, the mirror fills the
 *       pool's maps at once, stats, usage and search keys follow, the pack is sent, and the
 *       touched pages are marked stale. Problems come back per field; nothing is written then.
 * @author David @dvhsh (https://dvh.sh)
 * @created Fri Sep 25, 2026
 * @modified Fri Sep 25, 2026
 */

import "server-only";
import type { PacksService } from "@/env";
import type { Fetch } from "@/lib/packs-client";
import { revalidatePoolPages } from "@/lib/revalidate";
import { poolsCollection } from "@/models/Pool";
import type { AddPoolBody } from "@/schemas/admin";
import { type PoolSource, parseStoredPool } from "@/schemas/pool";
import { type SyncOutcome, syncPoolNow } from "@/services/admin";
import { applyImportPlan, loadExistingPools, seedBlankMaps } from "@/services/import";
import { type FillResult, fillMaps, type MapLookup } from "@/services/map-fill";
import { recomputePoolStats } from "@/services/pool-stats";
import { recomputeUsage } from "@/services/usage";
import { addedPoolName, readAddPoolMaps } from "@/utils/add-pool-input";
import { type ExistingPool, type PlannedPool, planImport, sourceKey } from "@/utils/import-plan";
import { editsFrom } from "@/utils/pool-record";
import { type RandomBytes, uniqueSourceId } from "@/utils/source-ids";
import { normalizePool, type SourceRef } from "@/utils/source-pools";

export type AddPoolDeps = {
  packsService?: () => PacksService | null;
  fetch?: Fetch;
  now?: () => Date;
  random?: RandomBytes;
  lookupMaps?: MapLookup;
  sleep?: (ms: number) => Promise<void>;
};

export type AddPoolAnswer = {
  /** A new record, or the source joined a stored one. */
  outcome: "created" | "merged";
  pool: { id: string; name: string; hidden: boolean; href: string };
  /** The stored record was superseded and is current again. */
  revived: boolean;
  /** Blank rows added for maps pools never saw, and the mirror fill of the pool's maps. */
  maps: FillResult & { added: number };
  sync: SyncOutcome;
};

export type AddPoolResult =
  | { ok: true; answer: AddPoolAnswer }
  | { ok: false; fields: Record<string, string> };

/** Every id taken for a kind: current and former sources, and inside pool ids. */
const takenIds = (kind: string, existing: readonly ExistingPool[]) => {
  const ids = new Set<string>();
  const poolIds = existing.map((record) => record.id);
  for (const record of existing) {
    for (const source of [...record.sources, ...record.formerSources]) {
      if (source.kind === kind) ids.add(source.id);
    }
  }
  return (id: string): boolean =>
    ids.has(id) || poolIds.some((poolId) => poolId.startsWith(`${kind}-${id}`));
};

/** A planned update that joins a stored record: only its sources and supersededBy change. */
const onlySources = (planned: PlannedPool, before: ExistingPool): PlannedPool => ({
  ...before,
  sources: planned.sources,
  formerSources: planned.formerSources,
  supersededBy: planned.supersededBy,
});

/** Which field a normalize refusal belongs to. */
const fieldOfReason = (reason: string): string =>
  /^The notes/u.test(reason) ? "notes" : /pool name/u.test(reason) ? "tournament" : "maps";

/**
 * @function addPool
 * @param body {AddPoolBody} the admin's form, parsed
 * @param deps {AddPoolDeps} packs, the mirror lookup, clock, waits and random bytes (tests)
 * @returns {Promise<AddPoolResult>} what was created or joined, the map fill and the pack's
 *          outcome; or the fields that are wrong, with nothing written
 */
export const addPool = async (
  body: AddPoolBody,
  deps: AddPoolDeps = {},
): Promise<AddPoolResult> => {
  const { now = () => new Date(), random, lookupMaps, sleep } = deps;
  const read = readAddPoolMaps(body.maps);
  if (!read.ok) return { ok: false, fields: { maps: read.message } };
  const existing = await loadExistingPools();
  const source: SourceRef = {
    kind: body.kind,
    id: uniqueSourceId(takenIds(body.kind, existing), random),
    credit: { name: body.creditName, ...(body.creditUrl ? { url: body.creditUrl } : {}) },
  };
  const normalized = normalizePool({
    source,
    name: addedPoolName(body),
    notes: body.notes,
    slots: read.slots,
    ...(read.shape ? { shape: read.shape } : {}),
  });
  if (!normalized.ok) {
    const { reason } = normalized.skipped;
    return { ok: false, fields: { [fieldOfReason(reason)]: reason } };
  }
  const at = now();
  const plan = planImport([normalized.pool], [], existing, at);
  const key = sourceKey(source);
  const hasSource = (record: PlannedPool) =>
    record.sources.some((entry: PoolSource) => sourceKey(entry) === key);
  const created = plan.creates.find(({ pool }) => hasSource(pool))?.pool;
  if (created) {
    created.edited = editsFrom(created.name, created.notes, {
      tournament: body.tournament,
      round: body.round,
      year: body.year,
      notes: created.notes,
    });
    created.badged = body.badged;
  }
  plan.updates = plan.updates.map(({ pool, before }) => ({
    pool: onlySources(pool, before),
    before,
  }));
  const targetId = created?.id ?? plan.updates.find(({ pool }) => hasSource(pool))?.pool.id;
  if (targetId === undefined) throw new Error("addPool: the new source landed nowhere.");
  await applyImportPlan(plan, at);

  const mapIds = [...new Set(normalized.pool.pool.slots.map((slot) => slot.beatmapId))];
  const added = await seedBlankMaps(mapIds, at);
  const fill = await fillMaps({
    ids: mapIds,
    now,
    ...(lookupMaps ? { lookup: lookupMaps } : {}),
    ...(sleep ? { sleep } : {}),
  });
  await recomputePoolStats([targetId]);
  await recomputeUsage(mapIds);
  const stored = parseStoredPool(await (await poolsCollection()).findOne({ _id: targetId }));
  if (!stored) throw new Error(`addPool: ${targetId} doesn't read back.`);
  const sync = await syncPoolNow(stored, deps);
  revalidatePoolPages([targetId], mapIds);
  return {
    ok: true,
    answer: {
      outcome: created ? "created" : "merged",
      pool: {
        id: targetId,
        name: stored.name,
        hidden: stored.hidden,
        href: `/admin/pools/${targetId}`,
      },
      revived: plan.revived.includes(targetId),
      maps: { added, ...fill },
      sync,
    },
  };
};
