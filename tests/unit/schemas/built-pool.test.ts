/**
 * @file tests/unit/schemas/built-pool.test.ts
 * @desc A built pool as stored: @haruhimemoe/pool's slots and buckets (bucket list rules, 64 maps,
 *       8 custom buckets), no map twice, a "b-" id, text fields trimmed, within their limits and
 *       through the content filter (one-line fields refuse line breaks, notes keep them), a year
 *       from 2007 to next year or none, editors (at most 10), the pack state, and nothing half-set.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

import { describe, expect, it } from "vitest";
import {
  builtNameSchema,
  builtNotesSchema,
  builtTournamentSchema,
  builtYearSchema,
  storedBuiltPoolSchema,
} from "@/schemas/built-pool";
import { makeBuiltPool } from "../../helpers/built-pools";

const parse = (overrides: Record<string, unknown>) =>
  storedBuiltPoolSchema.safeParse({ ...makeBuiltPool(), ...overrides });

describe("storedBuiltPoolSchema", () => {
  it("reads a stored pool", () => {
    expect(parse({}).success).toBe(true);
    const custom = parse({
      buckets: [
        { code: "NM" },
        { code: "HD" },
        { code: "HR" },
        { code: "DT" },
        { code: "FM" },
        { code: "EZ", color: 0, mods: { kind: "forced", set: ["EZ"] } },
        { code: "TB" },
      ],
      slots: [{ mod: "EZ", index: 1, beatmapId: 5 }],
    });
    expect(custom.success).toBe(true);
  });

  it.each([
    ["an id without b-", { _id: "host-abcdefgh" }],
    ["an unknown visibility", { visibility: "secret" }],
    ["a slot in a bucket the pool lacks", { slots: [{ mod: "EZ", index: 1, beatmapId: 5 }] }],
    [
      "the same map twice",
      {
        slots: [
          { mod: "NM", index: 1, beatmapId: 5 },
          { mod: "NM", index: 2, beatmapId: 5 },
        ],
      },
    ],
    [
      "65 maps",
      {
        slots: Array.from({ length: 65 }, (_, i) => ({
          mod: null,
          index: i + 1,
          beatmapId: i + 1,
        })),
      },
    ],
    ["11 editors", { editors: Array.from({ length: 11 }, (_, i) => editor(i + 1)) }],
    ["version 0", { version: 0 }],
    ["an unknown pack state", { pack: { state: "gone", slug: null, syncedAt: null, error: null } }],
    ["a null bucket list", { buckets: null }],
  ])("refuses %s", (_case, overrides) => {
    expect(parse(overrides).success).toBe(false);
  });
});

function editor(osuId: number) {
  return { userId: null, osuId, username: `e${osuId}`, addedAt: new Date() };
}

describe("text fields", () => {
  it("trims a name and keeps it to 1 to 64 characters, one line, through the filter", () => {
    expect(builtNameSchema.parse("  Spring Cup  ")).toBe("Spring Cup");
    for (const bad of ["", "   ", "x".repeat(65), "a\nb", "retard cup"]) {
      expect(builtNameSchema.safeParse(bad).success).toBe(false);
    }
  });

  it("lets tournament be empty, up to 100 characters, one line, through the filter", () => {
    expect(builtTournamentSchema.parse("")).toBe("");
    expect(builtTournamentSchema.safeParse("x".repeat(101)).success).toBe(false);
    expect(builtTournamentSchema.safeParse("heil hitler").success).toBe(false);
    expect(builtTournamentSchema.safeParse("a\tb").success).toBe(false);
  });

  it("keeps notes' line breaks, up to 2000 characters, through the filter", () => {
    expect(builtNotesSchema.parse("line one\nline two")).toBe("line one\nline two");
    expect(builtNotesSchema.safeParse("x".repeat(2001)).success).toBe(false);
    expect(builtNotesSchema.safeParse("ok\u0007").success).toBe(false);
    expect(builtNotesSchema.safeParse("sieg heil").success).toBe(false);
  });

  it("takes a year from 2007 to next year, or none", () => {
    const next = new Date().getUTCFullYear() + 1;
    expect(builtYearSchema.parse(null)).toBeNull();
    expect(builtYearSchema.parse(2007)).toBe(2007);
    expect(builtYearSchema.parse(next)).toBe(next);
    for (const bad of [2006, next + 1, 2020.5]) {
      expect(builtYearSchema.safeParse(bad).success).toBe(false);
    }
  });
});
