/**
 * @file tests/unit/schemas/built-pool.test.ts
 * @desc A built pool as stored: @haruhimemoe/pool's slots and buckets (bucket list rules, 64 maps,
 *       8 custom buckets), no map twice, a "b-" id, text fields trimmed, within their limits and
 *       through the content filter (one-line fields refuse line breaks, notes keep them), a year
 *       from 2007 to next year or none, editors (at most 10), the pack state, targets only on its buckets, and nothing half-set.
 *       No text field takes a lone surrogate (the driver would store U+FFFD in its place), and the
 *       filter's refusal carries the code content_filter. Reads use a shape-only schema, so a
 *       stored pool a newer filter would refuse still reads.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Mon Sep 28, 2026
 */

import { describe, expect, it } from "vitest";
import {
  builtNameSchema,
  builtNotesSchema,
  builtPoolReadSchema,
  builtRoundSchema,
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

  it("keeps targets on buckets the pool has", () => {
    const targets = { NM: { count: 5 }, HD: { count: 0, sr: { min: 5.8, max: 6.3 } } };
    const parsed = parse({ targets });
    expect(parsed.success && parsed.data.targets).toEqual(targets);
    expect(parse({ targets: { EZ: { count: 2 } } }).success).toBe(false);
    expect(parse({ targets: { NM: { count: 17 } } }).success).toBe(false);
    expect(parse({ targets: { NM: { count: 1, sr: { min: 7, max: 6 } } } }).success).toBe(false);
    expect(builtPoolReadSchema.safeParse(makeBuiltPool({ targets })).success).toBe(true);
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

  it("refuses a lone surrogate in every text field", () => {
    for (const schema of [builtNameSchema, builtTournamentSchema, builtRoundSchema]) {
      expect(schema.safeParse("Cup \uD800").error?.issues[0]?.message).toMatch(/broken character/);
    }
    expect(builtNotesSchema.safeParse("a\uDC00b").success).toBe(false);
    expect(builtNameSchema.parse("Cup \u{1F600}")).toBe("Cup \u{1F600}");
  });

  it("marks the content filter's refusal with the code content_filter", () => {
    const issue = builtNotesSchema.safeParse("sieg heil").error?.issues[0];
    expect(issue).toMatchObject({
      message: "That fails the content filter.",
      params: { code: "content_filter" },
    });
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

describe("builtPoolReadSchema", () => {
  const read = (overrides: Record<string, unknown>) =>
    builtPoolReadSchema.safeParse({ ...makeBuiltPool(), ...overrides });

  it("reads a stored pool whose text a newer content filter refuses", () => {
    expect(read({ name: "retard cup", notes: "sieg heil" }).success).toBe(true);
    expect(parse({ name: "retard cup" }).success).toBe(false);
  });

  it.each([
    ["an id without b-", { _id: "host-abcdefgh" }],
    ["an unknown visibility", { visibility: "secret" }],
    ["no slots", { slots: undefined }],
    ["a name that isn't text", { name: 5 }],
    ["a null bucket list", { buckets: null }],
  ])("still refuses %s", (_case, overrides) => {
    expect(read(overrides).success).toBe(false);
  });
});
