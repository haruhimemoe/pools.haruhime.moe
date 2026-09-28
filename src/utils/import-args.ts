/**
 * @file src/utils/import-args.ts
 * @desc The import command's arguments: `bun run import otdb [--dry-run] [--file <path>]
 *       [--no-sync] [--resync rejected]`, read into what the runner does, or a usage error. The
 *       runner reads IMPORT_SOURCES only (otdb): host and community pools come in through the
 *       admin page, so naming them is refused like any unknown source. Pure.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Mon Sep 28, 2026
 */

import { IMPORT_SOURCES, type ImportSource } from "@/constants/pools";

/** The import command's usage line. */
export const IMPORT_USAGE =
  "Usage: bun run import otdb [--dry-run] [--file <path>] [--no-sync] [--resync rejected]";

/** What the import command was asked to do. */
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
