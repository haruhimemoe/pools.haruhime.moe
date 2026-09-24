/**
 * @file tests/unit/utils/search-links.test.ts
 * @desc Where the home page's map box goes: a single beatmap ID or difficulty link opens that
 *       map's page; anything else (a set link, words) searches maps, capped at 100 characters.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { describe, expect, it } from "vitest";
import { mapSearchTarget } from "@/utils/search-links";

describe("mapSearchTarget", () => {
  it.each([
    ["129891", "/maps/129891"],
    [" https://osu.ppy.sh/beatmapsets/39804#osu/129891 ", "/maps/129891"],
    ["https://osu.ppy.sh/b/129891", "/maps/129891"],
    ["freedom dive", "/search?tab=maps&q=freedom%20dive"],
    [
      "https://osu.ppy.sh/beatmapsets/39804",
      "/search?tab=maps&q=https%3A%2F%2Fosu.ppy.sh%2Fbeatmapsets%2F39804",
    ],
    ["   ", "/search?tab=maps"],
  ])("sends %j to %s", (query, target) => {
    expect(mapSearchTarget(query)).toBe(target);
  });

  it("caps a long query at 100 characters", () => {
    expect(mapSearchTarget(`a b ${"x".repeat(200)}`)).toBe(
      `/search?tab=maps&q=${encodeURIComponent(`a b ${"x".repeat(96)}`)}`,
    );
  });
});
