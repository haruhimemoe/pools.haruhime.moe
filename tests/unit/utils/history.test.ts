/**
 * @file tests/unit/utils/history.test.ts
 * @desc A map's history rows: one per slot that has it (a map twice in one pool is two rows),
 *       newest year first, unknown years last, then tournament, round, pool and slot.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { describe, expect, it } from "vitest";
import { historyRows } from "@/utils/history";

const pool = (id: string, tournament: string, year: number | null, slots: [string, number][]) => ({
  _id: id,
  tournament,
  round: "Finals",
  year,
  badged: null,
  sourceSlots: slots.map(([label, beatmapId]) => ({ label, beatmapId, mods: [] })),
});

describe("historyRows", () => {
  it("lists every slot with the map, newest first, unknown years last", () => {
    const rows = historyRows(7, [
      pool("otdb-1", "Beta Cup", null, [["NM1", 7]]),
      pool("otdb-2", "Alpha Cup", 2020, [
        ["HD1", 7],
        ["HD2", 7],
        ["DT1", 8],
      ]),
      pool("otdb-3", "Gamma Cup", 2023, [["NM2", 7]]),
      pool("otdb-4", "Delta Cup", 2020, [["NM1", 9]]),
    ]);
    expect(rows.map((row) => `${row.poolId} ${row.slot}`)).toEqual([
      "otdb-3 NM2",
      "otdb-2 HD1",
      "otdb-2 HD2",
      "otdb-1 NM1",
    ]);
    expect(rows[0]).toEqual({
      poolId: "otdb-3",
      tournament: "Gamma Cup",
      round: "Finals",
      year: 2023,
      badged: null,
      slot: "NM2",
    });
  });
});
