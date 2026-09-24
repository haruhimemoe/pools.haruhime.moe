/**
 * @file tests/unit/utils/fold.test.ts
 * @desc Search folding (case, accents, full-width letters), search text from parts, query terms,
 *       and regex escaping that turns any typed text into a plain-text match.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { describe, expect, it } from "vitest";
import { escapeRegExp, foldForSearch, searchTerms, searchTextOf } from "@/utils/fold";

describe("foldForSearch", () => {
  it.each([
    ["PokÉmon", "pokemon"],
    ["Bundesländer", "bundeslander"],
    ["ＯＷＣ ２０２３", "owc 2023"],
    ["osu! World Cup", "osu! world cup"],
  ])("folds %j to %j", (text, folded) => {
    expect(foldForSearch(text)).toBe(folded);
  });
});

describe("searchTextOf", () => {
  it("folds the parts that are there, one per line", () => {
    expect(searchTextOf("OWC 2023 Finals", null, "", "Grand Finals")).toBe(
      "owc 2023 finals\ngrand finals",
    );
  });
});

describe("searchTerms", () => {
  it("splits folded text on whitespace", () => {
    expect(searchTerms("  osu!  World\tCUP ")).toEqual(["osu!", "world", "cup"]);
    expect(searchTerms("   ")).toEqual([]);
  });
});

describe("escapeRegExp", () => {
  it.each(["(20k-10k)", "C++", "[EZ]", "a.b*", "^$|?{}\\"])("matches %j as plain text", (text) => {
    const pattern = new RegExp(escapeRegExp(text), "u");
    expect(pattern.test(`x ${text} y`)).toBe(true);
    expect(pattern.source).not.toBe(text);
  });
});
