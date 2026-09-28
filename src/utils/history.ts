/**
 * @file src/utils/history.ts
 * @desc A map's tournament history from the pools that have it: one row per slot with the map
 *       (its source label), newest year first, unknown years last, then tournament, round,
 *       pool and slot, in code-unit order so it's the same everywhere. Pure.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Mon Sep 28, 2026
 */

import type { SourceSlotRecord } from "@/schemas/pool";

/** A current pool a map is in, with its slot there. */
export type HistoryRow = {
  poolId: string;
  tournament: string;
  round: string | null;
  year: number | null;
  badged: boolean | null;
  slot: string;
};

const byText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/**
 * @function compareHistory
 * @param a {HistoryRow} a row
 * @param b {HistoryRow} another
 * @returns {number} negative when a comes first
 */
export const compareHistory = (a: HistoryRow, b: HistoryRow): number => {
  if (a.year !== b.year) {
    if (a.year === null) return 1;
    if (b.year === null) return -1;
    return b.year - a.year;
  }
  return (
    byText(a.tournament, b.tournament) ||
    byText(a.round ?? "", b.round ?? "") ||
    byText(a.poolId, b.poolId) ||
    byText(a.slot, b.slot)
  );
};

/**
 * @function historyRows
 * @param mapId {number} the map
 * @param pools {readonly { _id: string; tournament: string; round: string | null; year: number | null;
 *        badged: boolean | null; sourceSlots: readonly SourceSlotRecord[] }[]} the pools that have it
 * @returns {HistoryRow[]} one row per slot with the map, sorted
 */
export const historyRows = (
  mapId: number,
  pools: readonly {
    _id: string;
    tournament: string;
    round: string | null;
    year: number | null;
    badged: boolean | null;
    sourceSlots: readonly SourceSlotRecord[];
  }[],
): HistoryRow[] =>
  pools
    .flatMap((pool) =>
      pool.sourceSlots
        .filter((slot) => slot.beatmapId === mapId)
        .map((slot) => ({
          poolId: pool._id,
          tournament: pool.tournament,
          round: pool.round,
          year: pool.year,
          badged: pool.badged,
          slot: slot.label,
        })),
    )
    .sort(compareHistory);
