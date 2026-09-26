/**
 * @file src/services/add-pool.ts
 * @desc An admin adds a host or community pool by hand, through the importer's own pipeline:
 *       the maps are read (src/utils/add-pool-input.ts) and normalized, the source gets a new
 *       generated id, and planImport decides. Maps no stored pool has make a new record
 *       "<kind>-<id>" named "<tournament> <year> <round>", with the typed fields as edits and
 *       badged; maps a stored record has push the source onto it (a superseded one is revived)
 *       and change nothing else, unless a source of the same kind with the same credit name and
 *       link is there already (then nothing is written and the answer says so). Writes are
 *       guarded: the push only lands on the record as planning read it, and a create that meets
 *       the fingerprint index (another add got there first) is planned again once, so it
 *       becomes a merge. Then maps pools never saw get blank rows, the mirror fills the pool's
 *       maps at once, stats, usage and search keys follow, the pack is sent, and the touched
 *       pages are marked stale. Problems come back per field; nothing is written then.
 * @author David @dvhsh (https://dvh.sh)
 * @created Fri Sep 25, 2026
 * @modified Sat Sep 26, 2026
 */

import "server-only";
import { MongoServerError } from "mongodb";
import type { PacksService } from "@/env";
import type { Fetch } from "@/lib/packs-client";
import { revalidatePoolPages } from "@/lib/revalidate";
import { poolsCollection } from "@/models/Pool";
import type { AddPoolBody } from "@/schemas/admin";
import { type PoolSource, parseStoredPool } from "@/schemas/pool";
import { type SyncOutcome, syncPoolNow } from "@/services/admin";
import { loadExistingPools, newPoolDoc, seedBlankMaps } from "@/services/import";
import { type FillResult, fillMaps, type MapLookup } from "@/services/map-fill";
import { recomputePoolStats } from "@/services/pool-stats";
import { recomputeUsage } from "@/services/usage";
import { type AddPoolMaps, addedPoolName, readAddPoolMaps } from "@/utils/add-pool-input";
import { type ExistingPool, type PlannedPool, planImport, sourceKey } from "@/utils/import-plan";
import { editsFrom, isVisible } from "@/utils/pool-record";
import { type RandomBytes, uniqueSourceId } from "@/utils/source-ids";
import { normalizePool, type SourceRef } from "@/utils/source-pools";

export type AddPoolDeps = {
  packsService?: () => PacksService | null;
  fetch?: Fetch;
  now?: () => Date;
  random?: RandomBytes;
  lookupMaps?: MapLookup;
  sleep?: (ms: number) => Promise<void>;
  /** The stored records as planning reads them (tests hand in a stale snapshot). */
  loadExisting?: () => Promise<ExistingPool[]>;
};

export type AddPoolAnswer = {
  /** A new record, or the source joined a stored one. */
  outcome: "created" | "merged";
  pool: { id: string; name: string; hidden: boolean; href: string };
  /** The stored record was superseded and is current again. */
  revived: boolean;
  /** The stored record already had a source of this kind with this credit: nothing was added. */
  alreadyCredited: boolean;
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

/** Where the source landed, or null when the record changed under us (plan again). */
type Landing = { outcome: "created" | "merged"; id: string; revived: boolean; credited: boolean };

const isDuplicateKey = (error: unknown): boolean =>
  error instanceof MongoServerError && error.code === 11000;

/** The same kind, credit name and credit link. */
const sameCredit = (entry: PoolSource, source: SourceRef): boolean =>
  entry.kind === source.kind &&
  "credit" in entry &&
  "credit" in source &&
  entry.credit.name === source.credit.name &&
  (entry.credit.url ?? null) === (source.credit.url ?? null);

/**
 * Pushes the source onto the record as planning read it (same fingerprint, same superseded
 * state, and on a revival the same hidden) unless that credit is there by then.
 */
const joinStored = async (before: ExistingPool, entry: PoolSource, at: Date): Promise<boolean> => {
  const revived = before.supersededBy !== null;
  const credit = "credit" in entry ? entry.credit : null;
  const filter = {
    _id: before.id,
    fingerprint: before.fingerprint,
    supersededBy: before.supersededBy,
    ...(revived ? { hidden: before.hidden } : {}),
    ...(credit
      ? {
          sources: {
            $not: {
              $elemMatch: {
                kind: entry.kind,
                "credit.name": credit.name,
                "credit.url": credit.url ?? null,
              },
            },
          },
        }
      : {}),
  };
  const set = revived
    ? { supersededBy: null, visible: isVisible({ ...before, supersededBy: null }), updatedAt: at }
    : { updatedAt: at };
  try {
    const pools = await poolsCollection();
    const result = await pools.updateOne(filter as never, { $push: { sources: entry }, $set: set });
    return result.matchedCount === 1;
  } catch (error) {
    if (isDuplicateKey(error)) return false;
    throw error;
  }
};

/** Which field a normalize refusal belongs to. */
const fieldOfReason = (reason: string): string =>
  /^The notes/u.test(reason) ? "notes" : /pool name/u.test(reason) ? "tournament" : "maps";

type Attempt =
  | { ok: false; fields: Record<string, string> }
  | { ok: true; landing: Landing | null; mapIds: number[] };

/** Plans the add over the stored records and writes it once: null landing means plan again. */
const landSource = async (
  body: AddPoolBody,
  read: Extract<AddPoolMaps, { ok: true }>,
  existing: readonly ExistingPool[],
  at: Date,
  random: RandomBytes | undefined,
): Promise<Attempt> => {
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
  const mapIds = [...new Set(normalized.pool.pool.slots.map((slot) => slot.beatmapId))];
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
    try {
      await (await poolsCollection()).insertOne(newPoolDoc(created, at));
    } catch (error) {
      if (isDuplicateKey(error)) return { ok: true, landing: null, mapIds };
      throw error;
    }
    const landing: Landing = {
      outcome: "created",
      id: created.id,
      revived: false,
      credited: false,
    };
    return { ok: true, landing, mapIds };
  }
  const joined = plan.updates.find(({ pool }) => hasSource(pool));
  if (!joined) throw new Error("addPool: the new source landed nowhere.");
  const { before } = joined;
  const landing: Landing = {
    outcome: "merged",
    id: before.id,
    revived: before.supersededBy !== null,
    credited: before.sources.some((entry) => sameCredit(entry, source)),
  };
  if (landing.credited) return { ok: true, landing, mapIds };
  const entry = joined.pool.sources.find((item) => sourceKey(item) === key);
  if (!entry) throw new Error("addPool: the planned source is missing.");
  const joinedOk = await joinStored(before, entry, at);
  return { ok: true, landing: joinedOk ? landing : null, mapIds };
};

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
  const { loadExisting = loadExistingPools } = deps;
  const read = readAddPoolMaps(body.maps);
  if (!read.ok) return { ok: false, fields: { maps: read.message } };
  const at = now();
  // A second try reads the records again: a guarded write missed because another add (or an
  // import) changed the record, or a create met the fingerprint index and is now a merge.
  let attempt = await landSource(body, read, await loadExisting(), at, random);
  if (attempt.ok && !attempt.landing) {
    attempt = await landSource(body, read, await loadExistingPools(), at, random);
  }
  if (!attempt.ok) return attempt;
  const { landing, mapIds } = attempt;
  if (!landing) throw new Error("addPool: the pool kept changing while it was added.");
  const targetId = landing.id;

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
      outcome: landing.outcome,
      pool: {
        id: targetId,
        name: stored.name,
        hidden: stored.hidden,
        href: `/admin/pools/${targetId}`,
      },
      revived: landing.revived,
      alreadyCredited: landing.credited,
      maps: { added, ...fill },
      sync,
    },
  };
};
