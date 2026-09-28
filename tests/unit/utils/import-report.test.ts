/**
 * @file tests/unit/utils/import-report.test.ts
 * @desc The runner's arguments (source, --dry-run, --file, --no-sync, --resync rejected, and
 *       every way they can be wrong), report text made safe for a terminal, the printed report
 *       (counts, skipped pools with reasons, merges, moves, maps, sync, stats) and the stored row,
 *       with why a run stopped when it threw. The CLI imports otdb only: host and community
 *       pools come in through the admin page, so naming them is refused like any unknown
 *       source; a report that lists one names it by kind, id and credit.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Mon Sep 28, 2026
 */

import { describe, expect, it } from "vitest";
import { parseImportArgs } from "@/utils/import-args";
import { planImport } from "@/utils/import-plan";
import {
  formatImportReport,
  type ImportSummary,
  importReportRow,
  reportText,
} from "@/utils/import-report";
import { otdbSource } from "@/utils/otdb";
import { normalizePool, type SourceRef } from "@/utils/source-pools";
import { emptySyncStates } from "@/utils/sync";

describe("parseImportArgs", () => {
  it("reads the source and every option", () => {
    expect(parseImportArgs(["otdb"])).toEqual({
      ok: true,
      args: { source: "otdb", dryRun: false, file: null, noSync: false, resyncRejected: false },
    });
    expect(parseImportArgs(["--dry-run", "otdb", "--file", "x.json"])).toMatchObject({
      ok: true,
      args: { dryRun: true, file: "x.json" },
    });
    expect(parseImportArgs(["otdb", "--file=y.json", "--no-sync"])).toMatchObject({
      ok: true,
      args: { file: "y.json", noSync: true },
    });
    expect(parseImportArgs(["otdb", "--resync", "rejected"])).toMatchObject({
      ok: true,
      args: { resyncRejected: true },
    });
    expect(parseImportArgs(["otdb", "--resync=rejected"])).toMatchObject({ ok: true });
  });

  it.each([
    [[], "Name a source to import from."],
    [["otr"], "Can't import from otr. Sources: otdb."],
    [["host"], "Can't import from host. Sources: otdb."],
    [["community"], "Can't import from community. Sources: otdb."],
    [["otdb", "otdb"], "Only one source at a time (got otdb and otdb)."],
    [["otdb", "--dry-run", "--dry-run"], "--dry-run is given twice."],
    [["otdb", "--file"], "--file needs a path."],
    [["otdb", "--file", "--dry-run"], "--file needs a path."],
    [["otdb", "--resync", "all"], "--resync takes one value: rejected."],
    [
      ["otdb", "--no-sync", "--resync", "rejected"],
      "--resync rejected needs a sync: drop --no-sync.",
    ],
    [["otdb", "--force"], "Unknown option --force."],
  ])("refuses %j", (argv, error) => {
    expect(parseImportArgs(argv)).toEqual({ ok: false, error });
  });
});

describe("reportText", () => {
  it("replaces control characters and cuts long text", () => {
    expect(reportText("Cup\u001b[2K\nFinals")).toBe("Cup�[2K�Finals");
    expect(reportText("x".repeat(300))).toHaveLength(200);
  });
});

const pool = (id: number | SourceRef, name: string, maps: number[]) => {
  const result = normalizePool({
    source: typeof id === "number" ? otdbSource(id) : id,
    name,
    notes: "",
    slots: maps.map((beatmapId, i) => ({ label: `NM${i + 1}`, beatmapId })),
  });
  if (!result.ok) throw new Error(result.skipped.reason);
  return result.pool;
};

describe("formatImportReport", () => {
  const plan = planImport(
    [pool(71, "USC 2017 Quarterfinals", [1, 2]), pool(418, "USA 2017 Quarterfinals", [1, 2])],
    [
      {
        kind: "otdb",
        id: "481",
        name: "Lobby\u001b 42",
        reason: "Slot DT1: DT1 appears more than once.",
      },
    ],
    [],
    new Date("2026-09-24T12:00:00.000Z"),
  );

  it("prints a dry run's counts and what it skipped and merged", () => {
    const summary: ImportSummary = {
      source: "otdb",
      read: 3,
      dryRun: true,
      plan,
      maps: null,
      usage: null,
      sync: null,
      stats: null,
    };
    const text = formatImportReport(summary);
    expect(text).toContain("otdb: 3 pools read. Dry run: nothing was written.");
    expect(text).toMatch(/ {2}New pools +1$/m);
    expect(text).toMatch(/ {2}Same pool twice +1$/m);
    expect(text).toMatch(/ {2}Skipped +1$/m);
    expect(text).toContain("  otdb #481  Lobby� 42: Slot DT1: DT1 appears more than once.");
    expect(text).toContain("  otdb #418 joins otdb-71");
    expect(text).not.toContain("Packs:");
  });

  it("names a host or community source by kind, id and credit", () => {
    const hosts: SourceRef = {
      kind: "host",
      id: "hz9y8x7w",
      credit: { name: "Spring\u001b Cup hosts" },
    };
    const joined = planImport(
      [pool(hosts, "Spring Cup 2020 Finals", [1, 2])],
      [],
      plan.creates.map(({ pool: record }) => record),
      new Date("2026-09-25T12:00:00.000Z"),
    );
    const text = formatImportReport({
      source: "otdb",
      read: 1,
      dryRun: true,
      plan: joined,
      maps: null,
      usage: null,
      sync: null,
      stats: null,
    });
    expect(text).toContain("  host hz9y8x7w (Spring� Cup hosts) joins otdb-71");
  });

  it("prints a real run's maps, sync and stats, and stores the row", () => {
    const summary: ImportSummary = {
      source: "otdb",
      read: 3,
      dryRun: false,
      plan,
      maps: { seeded: 2, asked: 2, filled: 1, missing: 1, error: null },
      usage: { maps: 2, updated: 2 },
      sync: {
        due: 1,
        sent: 1,
        states: { ...emptySyncStates(), created: 1 },
        remaining: 0,
        configError: null,
      },
      stats: { calls: 2, updated: 4, remaining: 0, stopped: "done", message: null },
    };
    const text = formatImportReport(summary);
    expect(text).toContain("Maps: 2 new, 2 asked the mirror, 1 filled, 1 not on the mirror.");
    expect(text).toContain("Usage: 2 of 2 maps changed.");
    expect(text).toContain("Packs: 1 of 1 due sent. 1 created");
    expect(text).toContain(
      "Pack stats: 4 updated in 2 calls, 0 left. Stopped: every pack's stats are complete.",
    );
    const startedAt = new Date("2026-09-24T12:00:00.000Z");
    const finishedAt = new Date("2026-09-24T12:05:00.000Z");
    expect(importReportRow(summary, { startedAt, finishedAt, ok: true })).toMatchObject({
      source: "otdb",
      startedAt,
      finishedAt,
      read: 3,
      ok: true,
      counts: { created: 1, merged: 1, skipped: 1, updated: 0 },
      skipped: plan.skipped,
      text,
    });
  });

  it("stores why a real run stopped, made safe for a terminal", () => {
    const summary: ImportSummary = {
      source: "otdb",
      read: 3,
      dryRun: false,
      plan,
      maps: { seeded: 2, asked: 2, filled: 2, missing: 0, error: null },
      usage: null,
      sync: null,
      stats: null,
    };
    const startedAt = new Date("2026-09-24T12:00:00.000Z");
    const finishedAt = new Date("2026-09-24T12:01:00.000Z");
    const row = importReportRow(summary, {
      startedAt,
      finishedAt,
      ok: false,
      error: "operation exceeded time limit\u001b[2J",
    });
    expect(row).toMatchObject({ ok: false, counts: { created: 1 }, sync: null });
    expect(row.text.startsWith(formatImportReport(summary))).toBe(true);
    expect(row.text.endsWith("\n\nStopped: operation exceeded time limit\uFFFD[2J")).toBe(true);
  });

  it("says when the sync was skipped or stopped", () => {
    const base: ImportSummary = {
      source: "otdb",
      read: 3,
      dryRun: false,
      plan,
      maps: null,
      usage: null,
      sync: "skipped",
      stats: null,
    };
    expect(formatImportReport(base)).toContain("Packs: not synced (--no-sync).");
    const stopped = formatImportReport({
      ...base,
      sync: {
        due: 2,
        sent: 0,
        states: emptySyncStates(),
        remaining: 2,
        configError: "packs refused the service token (401).",
      },
    });
    expect(stopped).toContain("2 still due.");
    expect(stopped).toContain("Stopped: packs refused the service token (401).");
  });
});
