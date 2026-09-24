/**
 * @file tests/unit/utils/compliance-view.test.ts
 * @desc How /check shows an answer: each map's verdict (its set's, "Not on osu!", or "Couldn't
 *       check"), the summary (not allowed before a closer look before couldn't check before all
 *       clear; a map osu! doesn't know needs a closer look), and notes split into text and https
 *       links only.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { describe, expect, it } from "vitest";
import type { CheckResponse } from "@/schemas/compliance";
import {
  MISSING_TEXT,
  noteParts,
  rowVerdict,
  summarizeCheck,
  UNCHECKED_TEXT,
} from "@/utils/compliance-view";

const ANSWER: CheckResponse = {
  sets: [
    { setId: 1, beatmapIds: [75], status: "ok", text: "Allowed", ranked: true },
    {
      setId: 101,
      beatmapIds: [1001, 1004],
      status: "disallowed",
      reason: "artist",
      text: "This artist doesn't allow their music in osu!",
      ranked: false,
    },
    {
      setId: 102,
      beatmapIds: [1002],
      status: "potential",
      notes: "See [the list](https://example.com).",
      text: "Needs a closer look",
      ranked: false,
    },
  ],
  missing: [999],
  unchecked: [555],
  maps: {},
};

describe("rowVerdict", () => {
  it("gives each map its set's verdict, or says why there's none", () => {
    expect(rowVerdict(ANSWER, 1004)).toEqual({
      tone: "disallowed",
      text: "This artist doesn't allow their music in osu!",
      notes: null,
      ranked: false,
    });
    expect(rowVerdict(ANSWER, 999)).toEqual({
      tone: "missing",
      text: MISSING_TEXT,
      notes: null,
      ranked: false,
    });
    expect(rowVerdict(ANSWER, 555)).toEqual({
      tone: "unchecked",
      text: UNCHECKED_TEXT,
      notes: null,
      ranked: false,
    });
    expect(rowVerdict(ANSWER, 1002).notes).toBe("See [the list](https://example.com).");
  });
});

describe("summarizeCheck", () => {
  it("leads with what isn't allowed, and counts everything", () => {
    expect(summarizeCheck(ANSWER, [75, 1001, 1002, 1004, 999, 555])).toEqual({
      tone: "disallowed",
      headline: "2 maps aren't allowed in officially supported tournaments.",
      counts: { ok: 1, potential: 2, disallowed: 2, unchecked: 1 },
    });
  });

  it("falls back to a closer look, then couldn't check, then all clear", () => {
    const only = (ids: number[]) => summarizeCheck(ANSWER, ids);
    expect(only([75, 999]).headline).toBe("1 map needs a closer look.");
    expect(only([75, 555]).headline).toBe("1 map couldn't be checked. Try again in a minute.");
    expect(only([75])).toMatchObject({
      tone: "ok",
      headline: "Every map meets the content rules for officially supported tournaments.",
    });
  });
});

describe("noteParts", () => {
  it("links https links and keeps everything else as text", () => {
    expect(
      noteParts("See [the list](https://example.com) and [this](javascript:alert(1))."),
    ).toEqual([
      { text: "See " },
      { text: "the list", href: "https://example.com" },
      { text: " and [this](javascript:alert(1))." },
    ]);
  });
});
