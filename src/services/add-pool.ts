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
 *       pages are marked stale. Problems come back per field; nothing is written then. The
 *       guarded join is src/services/add-pool-join.ts.
 * @author David @dvhsh (https://dvh.sh)
 * @created Fri Sep 25, 2026
 * @modified Sat Sep 26, 2026
 */

import "server-only";
import type { PacksService } from "@/env";
import type { Fetch } from "@/lib/packs-client";
import { revalidatePoolPages } from "@/lib/revalidate";
import { poolsCollection } from "@/models/Pool";
import type { AddPoolBody } from "@/schemas/admin";
import { type PoolSource, parseStoredPool } from "@/schemas/pool";
import { isDuplicateKey, joinStored, sameCredit, takenIds } from "@/services/add-pool-join";
import { type SyncOutcome, syncPoolNow } from "@/services/admin";
import { loadExistingPools, newPoolDoc, seedBlankMaps } from "@/services/import";
import { type FillResult, fillMaps, type MapLookup } from "@/services/map-fill";
import { recomputePoolStats } from "@/services/pool-stats";
import { recomputeUsage } from "@/services/usage";
import { type AddPoolMaps, addedPoolName, readAddPoolMaps } from "@/utils/add-pool-input";
import { type ExistingPool, type PlannedPool, planImport, sourceKey } from "@/utils/import-plan";
import { editsFrom } from "@/utils/pool-record";
import { type RandomBytes, uniqueSourceId } from "@/utils/source-ids";
import { normalizePool, type SourceRef } from "@/utils/source-pools";

/** The clock, ids, the mirror fill and the pack sync (tests). */
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

/** What an add did: created or merged, revived, already credited, the pool and its pack. */
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

/** An add's answer, or the refusals per field. */
export type AddPoolResult =
  | { ok: true; answer: AddPoolAnswer }
  | { ok: false; fields: Record<string, string> };

/** Where the source landed, or null when the record changed under us (plan again). */
type Landing = { outcome: "created" | "merged"; id: string; revived: boolean; credited: boolean };

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
