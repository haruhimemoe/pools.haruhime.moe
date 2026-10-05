/**
 * @file tests/unit/utils/map-preview.test.ts
 * @desc The song name a map's preview button reads out: "Artist - Title", or "Beatmap <id>" for
 *       a map not known yet.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Oct 5, 2026
 */

import { describe, expect, it } from "vitest";
import { songOf } from "@/utils/map-preview";

describe("map previews", () => {
  it("names the song", () => {
    expect(songOf({ artist: "xi", title: "Blue Zenith" }, 1)).toBe("xi - Blue Zenith");
    expect(songOf(undefined, 658127)).toBe("Beatmap 658127");
  });
});
