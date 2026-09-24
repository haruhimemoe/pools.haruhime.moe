/**
 * @file tests/unit/utils/pool-record.test.ts
 * @desc A pool record's derived fields: effective tournament, round and year (an admin's edit
 *       wins, null included), key, search text and sort name, visibility, the notes shown, and
 *       turning an admin form into only the edits that differ from the name and source notes.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { describe, expect, it } from "vitest";
import {
  derivedFields,
  editsFrom,
  effectiveFields,
  isVisible,
  shownNotes,
} from "@/utils/pool-record";

const NAME = "osu! World Cup 2023 Grand Finals";

describe("effectiveFields", () => {
  it("reads the name without edits", () => {
    expect(effectiveFields(NAME, {})).toEqual({
      tournament: "osu! World Cup",
      round: "Grand Finals",
      year: 2023,
    });
  });

  it("lets every edit win, a null round or year included", () => {
    expect(effectiveFields(NAME, { tournament: "OWC", round: null, year: null })).toEqual({
      tournament: "OWC",
      round: null,
      year: null,
    });
    expect(effectiveFields("Aeris 100k-160k February", { year: 2021 })).toEqual({
      tournament: "Aeris 100k-160k February",
      round: null,
      year: 2021,
    });
  });
});

describe("derivedFields", () => {
  it("keys the tournament and folds the search text and sort name", () => {
    expect(derivedFields(NAME, effectiveFields(NAME, {}))).toEqual({
      tournamentKey: "osu-world-cup",
      searchText: "osu! world cup 2023 grand finals\nosu! world cup\ngrand finals",
      sortName: "osu! world cup 2023 grand finals",
    });
  });
});

describe("isVisible and shownNotes", () => {
  it("hides hidden and superseded pools", () => {
    expect(isVisible({ hidden: false, supersededBy: null })).toBe(true);
    expect(isVisible({ hidden: true, supersededBy: null })).toBe(false);
    expect(isVisible({ hidden: false, supersededBy: "otdb-58-2" })).toBe(false);
  });

  it("shows edited notes over the source's", () => {
    expect(shownNotes("From otdb.", {})).toBe("From otdb.");
    expect(shownNotes("From otdb.", { notes: "Edited." })).toBe("Edited.");
    expect(shownNotes("From otdb.", { notes: "" })).toBe("");
  });
});

describe("editsFrom", () => {
  it("stores nothing when the form matches the name and the source notes", () => {
    expect(
      editsFrom(NAME, "HD optional.", {
        tournament: "osu! World Cup",
        round: "Grand Finals",
        year: 2023,
        notes: "HD optional.",
      }),
    ).toEqual({});
  });

  it("stores only what differs", () => {
    expect(
      editsFrom(NAME, "", { tournament: "osu! World Cup", round: null, year: 2024, notes: "" }),
    ).toEqual({ round: null, year: 2024 });
  });
});
