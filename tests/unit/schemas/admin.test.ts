/**
 * @file tests/unit/schemas/admin.test.ts
 * @desc What admin forms may send: a pool edit (trimmed text within limits and through the
 *       content filter, an empty round as none, a year from 2007, nothing else), a badged change
 *       for a tournament (one year, unknown years, or all), a retry, a refresh (an empty
 *       object), and an added pool (host or community, a credit name of 1 to 100 characters, an
 *       optional https link where empty means none, tournament, round, year, badged, notes and
 *       the maps as text), with each problem named by its field.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Fri Sep 25, 2026
 */

import { describe, expect, it } from "vitest";
import {
  addPoolBodySchema,
  badgedBodySchema,
  fieldErrors,
  poolEditBodySchema,
  revalidateBodySchema,
  syncBodySchema,
} from "@/schemas/admin";

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

describe("revalidateBodySchema", () => {
  it("takes an empty object and nothing else", () => {
    expect(revalidateBodySchema.parse({})).toEqual({});
    expect(revalidateBodySchema.safeParse({ all: true }).success).toBe(false);
    expect(revalidateBodySchema.safeParse(null).success).toBe(false);
  });
});

const ADD = {
  kind: "community",
  creditName: "  peppy ",
  creditUrl: " ",
  tournament: " Spring Cup ",
  round: "",
  year: null,
  badged: null,
  notes: "",
  maps: "NM1 129891",
};

describe("addPoolBodySchema", () => {
  it("trims the text, reads an empty link as none and an empty round as none", () => {
    expect(addPoolBodySchema.parse(ADD)).toEqual({
      ...ADD,
      creditName: "peppy",
      creditUrl: null,
      tournament: "Spring Cup",
      round: null,
    });
    expect(
      addPoolBodySchema.parse({ ...ADD, kind: "host", creditUrl: "https://example.com/sheet" }),
    ).toMatchObject({ kind: "host", creditUrl: "https://example.com/sheet" });
  });

  it.each([
    ["kind", { kind: "otdb" }, "Pick who sent the pool."],
    ["creditName", { creditName: " " }, "Give a name to credit."],
    ["creditName", { creditName: "a".repeat(101) }, "Keep the name to 100 characters."],
    ["creditName", { creditName: "retard hosts" }, "The name fails the content filter."],
    ["creditUrl", { creditUrl: "http://example.com" }, "Use an https link, or leave it empty."],
    ["creditUrl", { creditUrl: "javascript:alert(1)" }, "Use an https link, or leave it empty."],
    ["tournament", { tournament: "" }, "The tournament needs a name."],
    ["year", { year: 1999 }, "The year goes from 2007 to 2099."],
    ["maps", { maps: " " }, "Paste the maps."],
  ])("names %s when it's wrong", (field, change, message) => {
    const parsed = addPoolBodySchema.safeParse({ ...ADD, ...change });
    expect(parsed.success).toBe(false);
    expect(!parsed.success && fieldErrors(parsed.error)).toEqual({ [field]: message });
  });

  it("refuses fields nobody sends", () => {
    expect(addPoolBodySchema.safeParse({ ...ADD, extra: true }).success).toBe(false);
  });
});
