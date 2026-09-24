/**
 * @file tests/unit/schemas/admin.test.ts
 * @desc What admin forms may send: a pool edit (trimmed text within limits and through the
 *       content filter, an empty round as none, a year from 2007, nothing else), a badged change
 *       for a tournament (one year, unknown years, or all), and a retry.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { describe, expect, it } from "vitest";
import { badgedBodySchema, poolEditBodySchema, syncBodySchema } from "@/schemas/admin";

const EDIT = {
  tournament: " osu! World Cup ",
  round: "",
  year: 2023,
  notes: "HD optional.",
  hidden: false,
  badged: null,
};

describe("poolEditBodySchema", () => {
  it("trims text and reads an empty round as none", () => {
    expect(poolEditBodySchema.parse(EDIT)).toEqual({
      ...EDIT,
      tournament: "osu! World Cup",
      round: null,
    });
  });

  it("takes osu!'s first year and an unknown year", () => {
    expect(poolEditBodySchema.parse({ ...EDIT, year: 2007 }).year).toBe(2007);
    expect(poolEditBodySchema.parse({ ...EDIT, year: null }).year).toBeNull();
  });

  it.each([
    [{ ...EDIT, tournament: "   " }],
    [{ ...EDIT, tournament: "x".repeat(101) }],
    [{ ...EDIT, round: "y".repeat(101) }],
    [{ ...EDIT, year: 2006 }],
    [{ ...EDIT, year: 2023.5 }],
    [{ ...EDIT, notes: "z".repeat(2001) }],
    [{ ...EDIT, notes: "Win condition 14/88." }],
    [{ ...EDIT, extra: true }],
    [{ ...EDIT, hidden: "no" }],
  ])("refuses %j", (body) => {
    expect(poolEditBodySchema.safeParse(body).success).toBe(false);
  });
});

describe("badgedBodySchema and syncBodySchema", () => {
  it("reads a year, unknown years or all years", () => {
    for (const year of [2020, null, "all"]) {
      expect(
        badgedBodySchema.parse({ tournamentKey: "osu-world-cup", year, badged: true }).year,
      ).toBe(year);
    }
    expect(
      badgedBodySchema.safeParse({ tournamentKey: "", year: 2020, badged: true }).success,
    ).toBe(false);
    expect(syncBodySchema.parse({ includeRejected: true })).toEqual({ includeRejected: true });
  });
});
