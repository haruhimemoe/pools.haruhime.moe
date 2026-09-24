/**
 * @file tests/unit/utils/import-plan.test.ts
 * @desc Import planning with changes tracked per source: first import (ids "<kind>-<id>"), the
 *       same pool twice in one import (one record, lowest id's name, both sources), a rerun
 *       (nothing to write), a rename at the source (edits, hidden and badged kept), a changed
 *       pool (a new record inheriting hidden, badged and edited; the old one superseded once no
 *       source is left, its credit kept), ids never reused, a changed source leaving a record
 *       that keeps another source, revival of a superseded fingerprint, a move into another
 *       record, stored records absent from the run, and skipped pools carried through.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { describe, expect, it } from "vitest";
import { type ExistingPool, type ImportPlan, nextPoolId, planImport } from "@/utils/import-plan";
import { otdbSource } from "@/utils/otdb";
import { type NormalizedPool, normalizePool } from "@/utils/source-pools";

const NOW = new Date("2026-09-24T12:00:00.000Z");
const LATER = new Date("2026-10-01T12:00:00.000Z");

const pool = (id: number, name: string, maps: number[], notes = ""): NormalizedPool => {
  const result = normalizePool({
    source: otdbSource(id),
    name,
    notes,
    slots: maps.map((beatmapId, i) => ({ label: `NM${i + 1}`, beatmapId })),
  });
  if (!result.ok) throw new Error(result.skipped.reason);
  return result.pool;
};

/** A stored record made from a normalized pool, as a first import would have written it. */
const recordOf = (
  from: NormalizedPool,
  id: string,
  extra: Partial<ExistingPool> = {},
): ExistingPool => ({
  id,
  name: from.name,
  notes: from.notes,
  sourceSlots: from.sourceSlots,
  slots: from.pool.slots,
  ...(from.pool.buckets ? { buckets: from.pool.buckets } : {}),
  fingerprint: from.fingerprint,
  sources: [{ ...from.source, importedAt: NOW }],
  formerSources: [],
  supersededBy: null,
  hidden: false,
  badged: null,
  edited: {},
  ...extra,
});

/** Stored records after a plan is written. */
const applied = (existing: readonly ExistingPool[], plan: ImportPlan): ExistingPool[] => {
  const byId = new Map(existing.map((record) => [record.id, record]));
  for (const { pool: record } of [...plan.creates, ...plan.updates]) byId.set(record.id, record);
  return [...byId.values()];
};

const OWC = pool(657, "osu! World Cup 2023 Grand Finals", [1, 2, 3]);
const USC = pool(71, "United States Cup 2017 Quarter Finals", [10, 11]);
const USA = pool(418, "USA States Cup 2017 Quarterfinals", [10, 11]);

describe("nextPoolId", () => {
  it("uses <kind>-<id>, then the next free suffix", () => {
    expect(nextPoolId("otdb", "58", new Set())).toBe("otdb-58");
    expect(nextPoolId("otdb", "58", new Set(["otdb-58"]))).toBe("otdb-58-2");
    expect(nextPoolId("otdb", "58", new Set(["otdb-58", "otdb-58-2"]))).toBe("otdb-58-3");
  });
});

describe("planImport", () => {
  it("creates one record per new pool, named after its source", () => {
    const plan = planImport([USC, OWC], [], [], NOW);
    expect(
      plan.creates.map(({ pool: record, inheritedFrom }) => [record.id, inheritedFrom]),
    ).toEqual([
      ["otdb-71", null],
      ["otdb-657", null],
    ]);
    expect(plan.creates[1]?.pool).toMatchObject({
      name: "osu! World Cup 2023 Grand Finals",
      sources: [
        {
          kind: "otdb",
          id: "657",
          url: "https://otdb.sheppsu.me/db/mappools/657/",
          importedAt: NOW,
        },
      ],
      formerSources: [],
      supersededBy: null,
      hidden: false,
      badged: null,
      edited: {},
    });
  });

  it("makes the same pool twice in one import one record, named by the lowest id", () => {
    const plan = planImport([USC, USA], [], [], NOW);
    expect(plan.creates).toHaveLength(1);
    expect(plan.creates[0]?.pool).toMatchObject({
      id: "otdb-71",
      name: "United States Cup 2017 Quarter Finals",
    });
    expect(plan.creates[0]?.pool.sources.map((source) => source.id)).toEqual(["71", "418"]);
    expect(plan.merged).toEqual([{ source: otdbSource(418), into: "otdb-71" }]);
  });

  it("writes nothing on a rerun", () => {
    const first = planImport([USC, USA, OWC], [], [], NOW);
    const second = planImport([USC, USA, OWC], [], applied([], first), LATER);
    expect(second.creates).toEqual([]);
    expect(second.updates).toEqual([]);
    expect(second.merged).toEqual([]);
    expect(second.unchanged.sort()).toEqual(["otdb-657", "otdb-71"]);
  });

  it("follows a rename at the source, keeping edits, hidden, badged and import dates", () => {
    const stored = recordOf(OWC, "otdb-657", {
      hidden: true,
      badged: true,
      edited: { year: 2022 },
    });
    const renamed = pool(657, "osu! World Cup 2023 Finals", [1, 2, 3]);
    const plan = planImport([renamed], [], [stored], LATER);
    expect(plan.updates).toHaveLength(1);
    expect(plan.updates[0]?.pool).toMatchObject({
      name: "osu! World Cup 2023 Finals",
      hidden: true,
      badged: true,
      edited: { year: 2022 },
      sources: [{ id: "657", importedAt: NOW }],
    });
  });

  it("gives a changed pool a new record that inherits the admin's choices, and supersedes the old one", () => {
    const stored = recordOf(OWC, "otdb-657", {
      hidden: true,
      badged: true,
      edited: { round: "Finals" },
    });
    const changed = pool(657, "osu! World Cup 2023 Grand Finals", [1, 2, 4]);
    const plan = planImport([changed], [], [stored], LATER);
    expect(plan.creates).toEqual([
      {
        pool: expect.objectContaining({
          id: "otdb-657-2",
          hidden: true,
          badged: true,
          edited: { round: "Finals" },
          sources: [{ ...otdbSource(657), importedAt: LATER }],
        }),
        inheritedFrom: "otdb-657",
      },
    ]);
    expect(plan.updates[0]?.pool).toMatchObject({
      id: "otdb-657",
      sources: [],
      formerSources: [{ ...otdbSource(657), importedAt: NOW, leftAt: LATER }],
      supersededBy: "otdb-657-2",
    });
    expect(plan.moved).toEqual([{ source: otdbSource(657), from: "otdb-657", to: "otdb-657-2" }]);
    expect(plan.superseded).toEqual([{ id: "otdb-657", by: "otdb-657-2" }]);
  });

  it("never reuses an id", () => {
    const first = recordOf(OWC, "otdb-657", {
      sources: [],
      formerSources: [{ ...otdbSource(657), importedAt: NOW, leftAt: NOW }],
      supersededBy: "otdb-657-2",
    });
    const second = recordOf(pool(657, "osu! World Cup 2023 Grand Finals", [1, 2, 4]), "otdb-657-2");
    const third = pool(657, "osu! World Cup 2023 Grand Finals", [1, 2, 5]);
    const plan = planImport([third], [], [first, second], LATER);
    expect(plan.creates.map(({ pool: record }) => record.id)).toEqual(["otdb-657-3"]);
    expect(plan.superseded).toEqual([{ id: "otdb-657-2", by: "otdb-657-3" }]);
  });

  it("keeps a record current while another source still points at it", () => {
    const stored = recordOf(USC, "otdb-71", {
      sources: [
        { ...otdbSource(71), importedAt: NOW },
        { ...otdbSource(418), importedAt: NOW },
      ],
    });
    const changed = pool(418, "USA States Cup 2017 Quarterfinals", [10, 12]);
    const plan = planImport([USC, changed], [], [stored], LATER);
    expect(
      plan.creates.map(({ pool: record, inheritedFrom }) => [record.id, inheritedFrom]),
    ).toEqual([["otdb-418", "otdb-71"]]);
    expect(plan.updates[0]?.pool).toMatchObject({ id: "otdb-71", supersededBy: null });
    expect(plan.updates[0]?.pool.sources.map((source) => source.id)).toEqual(["71"]);
    expect(plan.superseded).toEqual([]);
  });

  it("revives a superseded record when its maps come back", () => {
    const old = recordOf(OWC, "otdb-657", {
      sources: [],
      formerSources: [{ ...otdbSource(657), importedAt: NOW, leftAt: NOW }],
      supersededBy: "otdb-657-2",
    });
    const current = recordOf(
      pool(657, "osu! World Cup 2023 Grand Finals", [1, 2, 4]),
      "otdb-657-2",
    );
    const plan = planImport([OWC], [], [old, current], LATER);
    expect(plan.creates).toEqual([]);
    expect(plan.revived).toEqual(["otdb-657"]);
    const byId = new Map(plan.updates.map(({ pool: record }) => [record.id, record]));
    expect(byId.get("otdb-657")).toMatchObject({
      supersededBy: null,
      sources: [{ id: "657", importedAt: LATER }],
    });
    expect(byId.get("otdb-657-2")).toMatchObject({ supersededBy: "otdb-657", sources: [] });
  });

  it("moves a changed source into the record that already has its maps", () => {
    const a = recordOf(pool(58, "Alpha Cup Finals", [1, 2]), "otdb-58");
    const b = recordOf(pool(60, "Beta Cup Finals", [3, 4]), "otdb-60");
    const plan = planImport(
      [pool(58, "Alpha Cup Finals", [3, 4]), pool(60, "Beta Cup Finals", [3, 4])],
      [],
      [a, b],
      LATER,
    );
    expect(plan.creates).toEqual([]);
    expect(plan.merged).toEqual([{ source: otdbSource(58), into: "otdb-60" }]);
    const byId = new Map(plan.updates.map(({ pool: record }) => [record.id, record]));
    expect(byId.get("otdb-60")?.sources.map((source) => source.id)).toEqual(["60", "58"]);
    // The lowest source id pointing at a record names it.
    expect(byId.get("otdb-60")?.name).toBe("Alpha Cup Finals");
    expect(byId.get("otdb-58")).toMatchObject({ supersededBy: "otdb-60" });
  });

  it("reports stored records this run doesn't list and leaves them alone", () => {
    const stored = recordOf(USC, "otdb-71");
    const plan = planImport([OWC], [], [stored], LATER);
    expect(plan.absent).toEqual(["otdb-71"]);
    expect(plan.updates).toEqual([]);
  });

  it("carries skipped pools through", () => {
    const skipped = [
      {
        kind: "otdb" as const,
        id: "481",
        name: "Lobby 42",
        reason: "Slot DT1: DT1 appears more than once.",
      },
    ];
    expect(planImport([], skipped, [], NOW).skipped).toEqual(skipped);
  });
});
