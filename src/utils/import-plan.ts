/**
 * @file src/utils/import-plan.ts
 * @desc Planning an import: normalized source pools against the pool records stored now, with
 *       changes tracked per source. A source whose fingerprint is still its record's stays. A
 *       source whose maps changed leaves its record (kept in formerSources, for the credit) for
 *       the record with its new fingerprint: a stored one (a superseded one is revived) or a
 *       new record "<kind>-<id>", then "-2", "-3"; ids are never reused, and a new record
 *       inherits hidden, badged and edited from the record the source left. A record is
 *       superseded once no source is left on it. A fingerprint seen twice in one run is one
 *       record with both sources. A record takes its name, notes, labels, slots and buckets from
 *       its lowest source id, and only when that source is in the run: a record whose lowest
 *       source is skipped or missing this time keeps what it has, so its name never flips to a
 *       higher source's. Stored records no source in the run points at are reported as absent,
 *       never touched. Superseded and revived list net changes only: a record superseded and
 *       revived in the same run is neither. The importer never changes hidden, badged or edited
 *       on a stored record. Pure.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import type { BucketEntry, PoolSlot } from "@haruhimemoe/pool";
import type { FormerSource, PoolEdits, PoolSource, SourceSlotRecord } from "@/schemas/pool";
import {
  bySourceId,
  type NormalizedPool,
  type SkippedPool,
  type SourceRef,
} from "@/utils/source-pools";

/** A stored pool record, as planning needs it. */
export type ExistingPool = {
  id: string;
  name: string;
  notes: string;
  sourceSlots: SourceSlotRecord[];
  slots: PoolSlot[];
  buckets?: BucketEntry[];
  fingerprint: string;
  sources: PoolSource[];
  formerSources: FormerSource[];
  supersededBy: string | null;
  hidden: boolean;
  badged: boolean | null;
  edited: PoolEdits;
};

/** A record as it should be after the import. */
export type PlannedPool = ExistingPool;

export type ImportPlan = {
  creates: { pool: PlannedPool; inheritedFrom: string | null }[];
  updates: { pool: PlannedPool; before: ExistingPool }[];
  unchanged: string[];
  absent: string[];
  merged: { source: SourceRef; into: string }[];
  moved: { source: SourceRef; from: string; to: string }[];
  superseded: { id: string; by: string }[];
  revived: string[];
  skipped: SkippedPool[];
};

/**
 * @function sourceKey
 * @param source {{ kind: string; id: string }} a pool at a source
 * @returns {string} "otdb:58"
 */
export const sourceKey = (source: { kind: string; id: string }): string =>
  `${source.kind}:${source.id}`;

/**
 * @function nextPoolId
 * @param kind {string} the source kind
 * @param sourceId {string} the pool's id at the source
 * @param taken {ReadonlySet<string>} every id stored or planned
 * @returns {string} "<kind>-<id>" when free, else the first free "-2", "-3"...
 */
export const nextPoolId = (kind: string, sourceId: string, taken: ReadonlySet<string>): string => {
  const base = `${kind}-${sourceId}`.toLowerCase().replace(/[^a-z0-9-]+/gu, "-");
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
};

/** A value with object keys sorted and dates as ISO text, for comparing records. */
const canonical = (value: unknown): unknown => {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entry]) => entry !== undefined)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, entry]) => [key, canonical(entry)]),
    );
  }
  return value;
};

/** A record's sources, lowest id first (the kind breaks a tie). */
const lowestSource = (sources: readonly PoolSource[]): PoolSource | undefined =>
  [...sources].sort(
    (a, b) => bySourceId(a, b) || (a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : 0),
  )[0];

/** The fields the importer owns, as comparable text. */
const importerView = (record: ExistingPool): string =>
  JSON.stringify(
    canonical({
      name: record.name,
      notes: record.notes,
      sourceSlots: record.sourceSlots,
      slots: record.slots,
      buckets: record.buckets ?? null,
      fingerprint: record.fingerprint,
      sources: record.sources,
      formerSources: record.formerSources,
      supersededBy: record.supersededBy,
    }),
  );

/**
 * @function planImport
 * @param pools {readonly NormalizedPool[]} the run's pools, lowest source id first
 * @param skipped {readonly SkippedPool[]} pools already left out, carried into the plan
 * @param existing {readonly ExistingPool[]} every stored record
 * @param now {Date} the run's clock (new sources' importedAt, leaving sources' leftAt)
 * @returns {ImportPlan} records to create and update, and what the report lists
 */
export const planImport = (
  pools: readonly NormalizedPool[],
  skipped: readonly SkippedPool[],
  existing: readonly ExistingPool[],
  now: Date,
): ImportPlan => {
  const before = new Map(existing.map((record) => [record.id, record]));
  const work = new Map(existing.map((record) => [record.id, structuredClone(record)]));
  const recordOf = (id: string): PlannedPool => {
    const found = work.get(id);
    if (!found) throw new Error(`planImport: no record ${id}`);
    return found;
  };
  const taken = new Set(work.keys());
  const byFingerprint = new Map<string, string>();
  for (const record of existing) {
    if (!byFingerprint.has(record.fingerprint) || record.supersededBy === null) {
      byFingerprint.set(record.fingerprint, record.id);
    }
  }
  const bySource = new Map<string, string>();
  for (const record of existing) {
    for (const source of record.sources) bySource.set(sourceKey(source), record.id);
  }
  const created = new Map<string, string | null>();
  const inRun = new Map(pools.map((pool) => [sourceKey(pool.source), pool]));
  const seen = new Set<string>();
  const plan: ImportPlan = {
    creates: [],
    updates: [],
    unchanged: [],
    absent: [],
    merged: [],
    moved: [],
    superseded: [],
    revived: [],
    skipped: [...skipped],
  };

  for (const pool of pools) {
    const key = sourceKey(pool.source);
    const currentId = bySource.get(key);
    const current = currentId === undefined ? undefined : recordOf(currentId);
    let targetId: string;
    if (current && current.fingerprint === pool.fingerprint) {
      targetId = current.id;
    } else {
      const known = byFingerprint.get(pool.fingerprint);
      if (known !== undefined) {
        targetId = known;
        const target = recordOf(known);
        target.sources.push({ ...pool.source, importedAt: now });
        if (target.supersededBy !== null) {
          target.supersededBy = null;
          plan.revived.push(known);
        }
        if (target.sources.length > 1) plan.merged.push({ source: pool.source, into: known });
      } else {
        targetId = nextPoolId(pool.source.kind, pool.source.id, taken);
        taken.add(targetId);
        work.set(targetId, {
          id: targetId,
          name: pool.name,
          notes: pool.notes,
          sourceSlots: pool.sourceSlots,
          slots: pool.pool.slots,
          ...(pool.pool.buckets ? { buckets: pool.pool.buckets } : {}),
          fingerprint: pool.fingerprint,
          sources: [{ ...pool.source, importedAt: now }],
          formerSources: [],
          supersededBy: null,
          hidden: current?.hidden ?? false,
          badged: current?.badged ?? null,
          edited: current ? structuredClone(current.edited) : {},
        });
        byFingerprint.set(pool.fingerprint, targetId);
        created.set(targetId, current?.id ?? null);
      }
      if (current) {
        const leaving = current.sources.find((source) => sourceKey(source) === key);
        current.sources = current.sources.filter((source) => sourceKey(source) !== key);
        if (leaving) current.formerSources.push({ ...leaving, leftAt: now });
        plan.moved.push({ source: pool.source, from: current.id, to: targetId });
        if (current.sources.length === 0) {
          current.supersededBy = targetId;
          plan.superseded.push({ id: current.id, by: targetId });
        }
      }
      bySource.set(key, targetId);
    }
    seen.add(targetId);
  }

  for (const id of seen) {
    const target = recordOf(id);
    const lowest = lowestSource(target.sources);
    const namer = lowest === undefined ? undefined : inRun.get(sourceKey(lowest));
    if (!namer) continue;
    target.name = namer.name;
    target.notes = namer.notes;
    target.sourceSlots = namer.sourceSlots;
    target.slots = namer.pool.slots;
    if (namer.pool.buckets) target.buckets = namer.pool.buckets;
    else delete target.buckets;
  }
  plan.superseded = plan.superseded.filter(({ id }) => recordOf(id).supersededBy !== null);
  plan.revived = plan.revived.filter((id) => (before.get(id)?.supersededBy ?? null) !== null);

  for (const [id, record] of work) {
    if (created.has(id)) {
      plan.creates.push({ pool: record, inheritedFrom: created.get(id) ?? null });
      continue;
    }
    const old = before.get(id);
    if (!old) continue;
    if (importerView(record) !== importerView(old))
      plan.updates.push({ pool: record, before: old });
    else if (seen.has(id)) plan.unchanged.push(id);
    else if (old.supersededBy === null) plan.absent.push(id);
  }
  return plan;
};
