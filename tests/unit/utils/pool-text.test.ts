/**
 * @file tests/unit/utils/pool-text.test.ts
 * @desc How pages write a pool's headline ("osu! World Cup · Grand Finals · 2023", "year
 *       unknown"), badged (only when known), and no-mod stars.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { describe, expect, it } from "vitest";
import { badgedText, poolHeadline, starsText, yearText } from "@/utils/pool-text";

describe("pool text", () => {
  it("writes the headline, the year or year unknown", () => {
    expect(poolHeadline({ tournament: "osu! World Cup", round: "Grand Finals", year: 2023 })).toBe(
      "osu! World Cup · Grand Finals · 2023",
    );
    expect(poolHeadline({ tournament: "Aeris 100k-160k February", round: null, year: null })).toBe(
      "Aeris 100k-160k February · year unknown",
    );
    expect(yearText(null)).toBe("year unknown");
  });

  it("writes badged only when it's known, and stars with two decimals", () => {
    expect(badgedText(true)).toBe("Badged");
    expect(badgedText(false)).toBe("Not badged");
    expect(badgedText(null)).toBeNull();
    expect(starsText(5.5)).toBe("5.50★");
    expect(starsText(null)).toBe("–");
  });
});
