/**
 * @file src/utils/pool-export.ts
 * @desc Exporting a built pool from what the page already holds (nothing new is fetched), in
 *       slot order: beatmap IDs with their slot labels; the lines a referee pastes into a
 *       multiplayer room, per osu!'s tournament management commands (`!mp map <id> 0`, 0 being
 *       osu!standard, then `!mp mods` with the slot's mods: None for a no-mod slot, the forced
 *       acronyms, or Freemod for FM, TB and freemod slots); and a CSV with each map's details
 *       and its values under the slot's mods (blank where they aren't known), every cell quoted
 *       where needed and kept from being read as a spreadsheet formula. Pure, and safe in the
 *       browser.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import {
  type BucketEntry,
  NO_MODS,
  type PoolSlot,
  slotLabel,
  slotModsFor,
} from "@haruhimemoe/pool";
import type { BuiltMaps } from "@/schemas/built-pool-view";
import { groupSlots } from "@/utils/built-editor";
import { groupSlotCode, type SlotValueMap, slotValueKey } from "@/utils/slot-values";

type ExportPool = { buckets: readonly BucketEntry[]; slots: readonly PoolSlot[] };

/** osu!standard in `!mp map`'s game mode. */
const OSU_STANDARD = 0;

const ordered = (pool: ExportPool) =>
  groupSlots(pool).flatMap((group) => group.slots.map((slot) => ({ slot, entry: group.entry })));

/**
 * @function idLines
 * @param pool {ExportPool} a pool
 * @returns {string} one "NM1 129891" line per slot
 */
export const idLines = (pool: ExportPool): string =>
  ordered(pool)
    .map(({ slot }) => `${slotLabel(slot)} ${slot.beatmapId}`)
    .join("\n");

const modsText = (entry: BucketEntry | null): string => {
  const mods = entry ? slotModsFor(entry) : NO_MODS;
  if (mods.kind === "forced") return mods.set.join(" ");
  return mods.kind === "free" ? "Freemod" : "None";
};

/**
 * @function mpLines
 * @param pool {ExportPool} a pool
 * @returns {string} per slot, `!mp map <id> 0` and `!mp mods <mods>`, slots a blank line apart
 */
export const mpLines = (pool: ExportPool): string =>
  ordered(pool)
    .map(
      ({ slot, entry }) => `!mp map ${slot.beatmapId} ${OSU_STANDARD}\n!mp mods ${modsText(entry)}`,
    )
    .join("\n\n");

export type ExportRow = (string | number | null)[];

const HEADER = [
  "Slot",
  "Beatmap ID",
  "Set ID",
  "Artist",
  "Title",
  "Version",
  "Mapper",
  "Stars (with mods)",
  "Length (s)",
  "BPM",
  "AR",
  "OD",
  "CS",
];

const num = (value: number | null | undefined, digits?: number): number | string | null => {
  if (value == null) return null;
  return digits === undefined ? Math.round(value * 100) / 100 : value.toFixed(digits);
};

/**
 * @function exportRows
 * @param pool {ExportPool} a pool
 * @param maps {BuiltMaps} its map details
 * @param values {SlotValueMap} values under each slot's mods, as far as they're known
 * @returns {ExportRow[]} one row per slot, in order (the CSV's cells)
 */
export const exportRows = (pool: ExportPool, maps: BuiltMaps, values: SlotValueMap): ExportRow[] =>
  ordered(pool).map(({ slot, entry }) => {
    const map = maps[slot.beatmapId] ?? null;
    const code = groupSlotCode(slot, entry);
    // Until the values under the slot's mods are known, a no-mod slot's are the map's own.
    const facts = values[slotValueKey(slot.beatmapId, code)] ?? (code === "NM" ? map : null);
    return [
      slotLabel(slot),
      slot.beatmapId,
      map?.setId ?? null,
      map?.artist ?? null,
      map?.title ?? null,
      map?.version ?? null,
      map?.setHost ?? null,
      num(facts?.stars, 2),
      num(facts?.length),
      num(facts?.bpm),
      num(facts?.ar),
      num(facts?.od),
      num(facts?.cs),
    ];
  });

const cell = (value: string | number | null): string => {
  if (value === null) return "";
  // A leading =, +, - or @ would make a spreadsheet run the cell as a formula.
  const text =
    typeof value === "string" && /^[=+\-@\t\r]/.test(value) ? `'${value}` : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/**
 * @function csvOf
 * @param rows {readonly ExportRow[]} exportRows' rows
 * @returns {string} the CSV, header first, CRLF line ends and a closing one
 */
export const csvOf = (rows: readonly ExportRow[]): string =>
  `${[HEADER, ...rows].map((row) => row.map(cell).join(",")).join("\r\n")}\r\n`;

/**
 * @function csvFileName
 * @param name {string} the pool's name
 * @returns {string} "spring-cup-finals.csv" ("pool.csv" when nothing is left)
 */
export const csvFileName = (name: string): string => {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${slug || "pool"}.csv`;
};
