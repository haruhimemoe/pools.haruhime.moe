/**
 * @file src/utils/import-report.ts
 * @desc The import runner's arguments and its report: counts (new, updated, unchanged, the same
 *       pool twice, changed at the source, superseded, revived, not in this export, skipped),
 *       each skipped pool with its reason, what merged, moved and was superseded, the map fill,
 *       usage, the pack sync and the stats backfill; and the row stored in `imports` (with why
 *       the run stopped, when it threw). Every piece of source text has its control characters
 *       replaced and is cut short, so an export can't drive the admin's terminal. The runner
 *       reads IMPORT_SOURCES only (otdb): host and community pools come in through the admin
 *       page, so naming them is refused like any unknown source. A report names an otdb pool
 *       "otdb #58" and a host or community one by kind, id and credit. Pure.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Fri Sep 25, 2026
 */

import {
  IMPORT_SOURCES,
  type ImportSource,
  SOURCE_CREDITS,
  type SourceKind,
} from "@/constants/pools";
import { SYNC_STATES } from "@/schemas/pool";
import type { ImportPlan } from "@/utils/import-plan";
import type { SkippedPool, SourceRef } from "@/utils/source-pools";
import type { BackfillResult, SyncSummary } from "@/utils/sync";

export const IMPORT_USAGE =
  "Usage: bun run import otdb [--dry-run] [--file <path>] [--no-sync] [--resync rejected]";

export type ImportArgs = {
  source: ImportSource;
  dryRun: boolean;
  file: string | null;
  noSync: boolean;
  resyncRejected: boolean;
};

/**
 * @function parseImportArgs
 * @param argv {readonly string[]} the runner's arguments (after the script name)
 * @returns {{ ok: true; args: ImportArgs } | { ok: false; error: string }} the source and
 *          options, or what's wrong: a missing source or one the runner doesn't read (anything
 *          but IMPORT_SOURCES, host and community included), a repeated option, --file
 *          without a path, --resync with anything but "rejected", --resync with --no-sync, or
 *          an unknown option
 */
export const parseImportArgs = (
  argv: readonly string[],
): { ok: true; args: ImportArgs } | { ok: false; error: string } => {
  let source: ImportSource | null = null;
  let dryRun = false;
  let noSync = false;
  let file: string | null = null;
  let resync: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] ?? "";
    if (arg === "--dry-run") {
      if (dryRun) return { ok: false, error: "--dry-run is given twice." };
      dryRun = true;
    } else if (arg === "--no-sync") {
      if (noSync) return { ok: false, error: "--no-sync is given twice." };
      noSync = true;
    } else if (arg === "--file" || arg.startsWith("--file=")) {
      if (file !== null) return { ok: false, error: "--file is given twice." };
      const value = arg === "--file" ? argv[++i] : arg.slice("--file=".length);
      if (!value || value.startsWith("--")) return { ok: false, error: "--file needs a path." };
      file = value;
    } else if (arg === "--resync" || arg.startsWith("--resync=")) {
      if (resync !== null) return { ok: false, error: "--resync is given twice." };
      const value = arg === "--resync" ? argv[++i] : arg.slice("--resync=".length);
      if (value !== "rejected") return { ok: false, error: "--resync takes one value: rejected." };
      resync = value;
    } else if (arg.startsWith("-")) {
      return { ok: false, error: `Unknown option ${arg}.` };
    } else if (source !== null) {
      return { ok: false, error: `Only one source at a time (got ${source} and ${arg}).` };
    } else {
      const kind = IMPORT_SOURCES.find((known) => known === arg);
      if (!kind) {
        return {
          ok: false,
          error: `Can't import from ${arg}. Sources: ${IMPORT_SOURCES.join(", ")}.`,
        };
      }
      source = kind;
    }
  }
  if (source === null) return { ok: false, error: "Name a source to import from." };
  if (noSync && resync !== null) {
    return { ok: false, error: "--resync rejected needs a sync: drop --no-sync." };
  }
  return { ok: true, args: { source, dryRun, file, noSync, resyncRejected: resync !== null } };
};

/** C0 and C1 control characters, DEL included (Unicode's Cc). */
const CONTROL = /\p{Cc}/gu;
/** The most characters of one piece of source text the report prints. */
const REPORT_TEXT_MAX = 200;

/**
 * @function reportText
 * @param text {string} text a source gave (a name, a label inside a reason)
 * @returns {string} every control character as U+FFFD, at most 200 characters (cut with "…")
 */
export const reportText = (text: string): string => {
  const safe = text.replace(CONTROL, "�");
  return safe.length > REPORT_TEXT_MAX ? `${safe.slice(0, REPORT_TEXT_MAX - 1)}…` : safe;
};

export type FillSummary = {
  seeded: number;
  asked: number;
  filled: number;
  missing: number;
  error: string | null;
};

export type ImportSummary = {
  source: SourceKind;
  read: number;
  dryRun: boolean;
  plan: ImportPlan;
  /** Null on a dry run. */
  maps: FillSummary | null;
  usage: { maps: number; updated: number } | null;
  /** "skipped" with --no-sync; null on a dry run. */
  sync: SyncSummary | "skipped" | null;
  stats: BackfillResult | null;
};

/**
 * @function importCounts
 * @param plan {ImportPlan} a plan
 * @returns the count of each kind of change
 */
export const importCounts = (plan: ImportPlan) => ({
  created: plan.creates.length,
  updated: plan.updates.length,
  unchanged: plan.unchanged.length,
  merged: plan.merged.length,
  moved: plan.moved.length,
  superseded: plan.superseded.length,
  revived: plan.revived.length,
  absent: plan.absent.length,
  skipped: plan.skipped.length,
});

/** "otdb #58", or a host or community pool's kind, id and credit: "host hz9y8x7w (Name)". */
const labelOf = (source: SourceRef | SkippedPool): string => {
  const { label } = SOURCE_CREDITS[source.kind];
  const id = reportText(source.id);
  if (source.kind === "otdb") return `${label} #${id}`;
  return "credit" in source
    ? `${label} ${id} (${reportText(source.credit.name)})`
    : `${label} ${id}`;
};

const STOP_REASONS: Readonly<Record<BackfillResult["stopped"], string>> = {
  done: "every pack's stats are complete",
  "no-progress": "5 calls in a row updated nothing",
  limit: "the call limit was reached",
  config: "packs refused the token",
};

/**
 * @function formatImportReport
 * @param summary {ImportSummary} what the run did
 * @returns {string} the report the runner prints (and the admin page shows)
 */
export const formatImportReport = (summary: ImportSummary): string => {
  const counts = importCounts(summary.plan);
  const rows: [string, number][] = [
    ["New pools", counts.created],
    ["Updated", counts.updated],
    ["Unchanged", counts.unchanged],
    ["Same pool twice", counts.merged],
    ["Changed at the source", counts.moved],
    ["Superseded", counts.superseded],
    ["Revived", counts.revived],
    ["Not in this export", counts.absent],
    ["Skipped", counts.skipped],
  ];
  const width = Math.max(...rows.map(([name]) => name.length));
  const lines = [
    `${SOURCE_CREDITS[summary.source].label}: ${summary.read} ${summary.read === 1 ? "pool" : "pools"} read.${
      summary.dryRun ? " Dry run: nothing was written." : ""
    }`,
    "",
    ...rows.map(([name, count]) => `  ${name.padEnd(width)}  ${String(count).padStart(5)}`),
  ];
  const section = (title: string, entries: string[]) => {
    if (entries.length > 0) lines.push("", title, ...entries.map((entry) => `  ${entry}`));
  };
  const { plan } = summary;
  section(
    "Skipped:",
    plan.skipped.map(
      (pool) => `${labelOf(pool)}  ${reportText(pool.name)}: ${reportText(pool.reason)}`,
    ),
  );
  section(
    "Same pool twice (one record, every source):",
    plan.merged.map(({ source, into }) => `${labelOf(source)} joins ${into}`),
  );
  section(
    "Changed at the source:",
    plan.moved.map(({ source, from, to }) => `${labelOf(source)} moves from ${from} to ${to}`),
  );
  section(
    "Superseded:",
    plan.superseded.map(({ id, by }) => `${id}, replaced by ${by}`),
  );
  section("Revived:", plan.revived);
  section("Not in this export (left as they are):", plan.absent);
  if (summary.maps) {
    const { seeded, asked, filled, missing, error } = summary.maps;
    lines.push(
      "",
      `Maps: ${seeded} new, ${asked} asked the mirror, ${filled} filled, ${missing} not on the mirror.`,
    );
    if (error) lines.push(`  ${reportText(error)}`);
  }
  if (summary.usage) {
    lines.push(`Usage: ${summary.usage.updated} of ${summary.usage.maps} maps changed.`);
  }
  if (summary.sync === "skipped") {
    lines.push("", "Packs: not synced (--no-sync).");
  } else if (summary.sync) {
    const { due, sent, states, remaining, configError } = summary.sync;
    const answered = SYNC_STATES.filter((state) => states[state] > 0)
      .map((state) => `${states[state]} ${state}`)
      .join(", ");
    lines.push("", `Packs: ${sent} of ${due} due sent. ${answered || "No answers."}`);
    if (remaining > 0) lines.push(`  ${remaining} still due.`);
    if (configError) lines.push(`  Stopped: ${reportText(configError)}`);
  }
  if (summary.stats) {
    const { calls, updated, remaining, stopped, message } = summary.stats;
    const left = remaining === null ? "" : `, ${remaining} left`;
    const why = stopped === "config" && message ? message : STOP_REASONS[stopped];
    lines.push(
      `Pack stats: ${updated} updated in ${calls} ${calls === 1 ? "call" : "calls"}${left}. Stopped: ${reportText(why)}${why.endsWith(".") ? "" : "."}`,
    );
  }
  return lines.join("\n");
};

/** One real run, as stored in `imports` and listed on /admin. */
export type ImportReportRow = {
  source: SourceKind;
  startedAt: Date;
  finishedAt: Date;
  read: number;
  counts: ReturnType<typeof importCounts>;
  skipped: SkippedPool[];
  maps: FillSummary | null;
  sync: SyncSummary | null;
  stats: BackfillResult | null;
  ok: boolean;
  text: string;
};

/**
 * @function importReportRow
 * @param summary {ImportSummary} what the run did (so far, when it threw)
 * @param run {{ startedAt: Date; finishedAt: Date; ok: boolean; error?: string }} when, whether
 *        it ended well, and the error that stopped it, if one did
 * @returns {ImportReportRow} the row to store; a stopped run's text ends with why
 */
export const importReportRow = (
  summary: ImportSummary,
  {
    startedAt,
    finishedAt,
    ok,
    error,
  }: { startedAt: Date; finishedAt: Date; ok: boolean; error?: string },
): ImportReportRow => ({
  source: summary.source,
  startedAt,
  finishedAt,
  read: summary.read,
  counts: importCounts(summary.plan),
  skipped: summary.plan.skipped,
  maps: summary.maps,
  sync: summary.sync === "skipped" ? null : summary.sync,
  stats: summary.stats,
  ok,
  text:
    error === undefined
      ? formatImportReport(summary)
      : `${formatImportReport(summary)}\n\nStopped: ${reportText(error)}`,
});
