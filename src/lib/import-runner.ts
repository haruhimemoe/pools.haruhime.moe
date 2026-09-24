/**
 * @file src/lib/import-runner.ts
 * @desc `bun run import otdb [--dry-run] [--file <path>] [--no-sync] [--resync rejected]`
 *       (scripts/import.ts), run by David with the scoped pools database user. It reads otdb's
 *       export (downloaded, or --file), plans against the stored pools, and on a dry run prints
 *       the plan and writes nothing. A real run writes the pools, seeds and fills maps from the
 *       mirror, rebuilds stats and usage, syncs packs (unless --no-sync) and runs the stats
 *       backfill, stores a report in `imports` and prints it. Rerunning is safe. Exit codes:
 *       0 done (skipped pools included), 1 a fatal error or a sync configuration error, 2 bad
 *       arguments. Every outside call is injectable, so tests never reach otdb, the mirror or
 *       packs.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import "server-only";
import { readFile } from "node:fs/promises";
import { OTDB_EXPORT_URL } from "@/constants/pools";
import { SERVER_USER_AGENT } from "@/constants/site";
import { EnvError, getPacksService, type PacksService } from "@/env";
import type { Fetch } from "@/lib/packs-client";
import { applyImportPlan, loadExistingPools, seedMaps } from "@/services/import";
import { writeImportReport } from "@/services/imports";
import { fillMaps, type MapLookup } from "@/services/map-fill";
import { recomputePoolStats } from "@/services/pool-stats";
import { runStatsBackfill, syncPools } from "@/services/sync";
import { recomputeUsage } from "@/services/usage";
import { planImport } from "@/utils/import-plan";
import {
  formatImportReport,
  IMPORT_USAGE,
  type ImportSummary,
  importReportRow,
  parseImportArgs,
} from "@/utils/import-report";
import { readOtdbExport } from "@/utils/otdb";
import { normalizePools } from "@/utils/source-pools";
import { emptySyncStates } from "@/utils/sync";

export type ImportDeps = {
  fetch?: Fetch;
  readFile?: (path: string) => Promise<string>;
  log?: (text: string) => void;
  warn?: (text: string) => void;
  now?: () => Date;
  lookupMaps?: MapLookup;
  packsService?: () => PacksService | null;
  sleep?: (ms: number) => Promise<void>;
};

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/**
 * @function downloadOtdbExport
 * @param doFetch {Fetch} fetch (tests)
 * @returns {Promise<unknown>} the export, parsed as JSON
 * @throws {Error} when the download fails or isn't JSON
 */
export const downloadOtdbExport = async (doFetch: Fetch = globalThis.fetch): Promise<unknown> => {
  const response = await doFetch(OTDB_EXPORT_URL, {
    headers: { Accept: "application/json", "User-Agent": SERVER_USER_AGENT },
  });
  if (!response.ok) throw new Error(`Downloading the otdb export failed (${response.status}).`);
  return response.json();
};

/** packs' address and token, or why the sync can't run. */
const serviceOf = (read: () => PacksService | null): PacksService | string => {
  try {
    return (
      read() ??
      "POOLS_SERVICE_TOKEN isn't set, so packs can't be updated. Set it, or run with --no-sync."
    );
  } catch (error) {
    if (error instanceof EnvError) return error.message;
    throw error;
  }
};

/**
 * @function runImport
 * @param argv {readonly string[]} the arguments after the script name
 * @param deps {ImportDeps} outside calls, clock and waits (tests)
 * @returns {Promise<number>} the exit code
 */
export const runImport = async (
  argv: readonly string[],
  {
    fetch: doFetch = globalThis.fetch,
    readFile: read = (file) => readFile(file, "utf8"),
    log = console.log,
    warn = console.error,
    now = () => new Date(),
    lookupMaps,
    packsService = getPacksService,
    sleep,
  }: ImportDeps = {},
): Promise<number> => {
  const parsed = parseImportArgs(argv);
  if (!parsed.ok) {
    warn(parsed.error);
    warn(IMPORT_USAGE);
    return 2;
  }
  const { source, dryRun, file, noSync, resyncRejected } = parsed.args;
  const startedAt = now();
  try {
    const raw: unknown =
      file === null ? await downloadOtdbExport(doFetch) : JSON.parse(await read(file));
    const exported = readOtdbExport(raw);
    const normalized = normalizePools(exported.pools);
    const plan = planImport(
      normalized.pools,
      [...exported.skipped, ...normalized.skipped],
      await loadExistingPools(),
      startedAt,
    );
    const summary: ImportSummary = {
      source,
      read: exported.pools.length + exported.skipped.length,
      dryRun,
      plan,
      maps: null,
      usage: null,
      sync: null,
      stats: null,
    };
    if (dryRun) {
      log(formatImportReport(summary));
      return 0;
    }
    await applyImportPlan(plan, startedAt);
    const mapIds = normalized.pools.flatMap((pool) =>
      pool.pool.slots.map((slot) => slot.beatmapId),
    );
    const seeded = await seedMaps(exported.maps, mapIds, startedAt);
    const fill = await fillMaps({
      ...(lookupMaps ? { lookup: lookupMaps } : {}),
      now,
      ...(sleep ? { sleep } : {}),
    });
    summary.maps = { seeded, ...fill };
    await recomputePoolStats();
    summary.usage = await recomputeUsage();
    let code = 0;
    if (noSync) {
      summary.sync = "skipped";
    } else {
      const service = serviceOf(packsService);
      if (typeof service === "string") {
        summary.sync = {
          due: 0,
          sent: 0,
          states: emptySyncStates(),
          remaining: 0,
          configError: service,
        };
        code = 1;
      } else {
        summary.sync = await syncPools({
          service,
          resyncRejected,
          fetch: doFetch,
          now,
          ...(sleep ? { sleep } : {}),
        });
        if (summary.sync.configError !== null) code = 1;
        else
          summary.stats = await runStatsBackfill({
            service,
            fetch: doFetch,
            log,
            ...(sleep ? { sleep } : {}),
          });
      }
    }
    await writeImportReport(
      importReportRow(summary, { startedAt, finishedAt: now(), ok: code === 0 }),
    );
    log(formatImportReport(summary));
    return code;
  } catch (error) {
    warn(`import stopped: ${messageOf(error)}`);
    return 1;
  }
};
