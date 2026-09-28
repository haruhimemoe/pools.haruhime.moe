/**
 * @file tests/unit/utils/map-preview.test.ts
 * @desc Map previews come straight from osu!'s CDN: the set's list cover on assets.ppy.sh and
 *       its preview clip on b.ppy.sh, and their alt text and button names.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { describe, expect, it } from "vitest";
import {
  coverAlt,
  previewClipUrl,
  previewCoverUrl,
  previewLabel,
  songOf,
} from "@/utils/map-preview";

describe("map previews", () => {
  it("builds the cover and clip URLs on osu!'s CDN", () => {
    expect(previewCoverUrl(1030499)).toBe("https://assets.ppy.sh/beatmaps/1030499/covers/list.jpg");
    expect(previewClipUrl(1030499)).toBe("https://b.ppy.sh/preview/1030499.mp3");
  });

  it("names the cover and the play button after the song", () => {
    expect(coverAlt("xi - Blue Zenith")).toBe("Cover art for xi - Blue Zenith");
    expect(previewLabel("xi - Blue Zenith", false)).toBe("Play preview of xi - Blue Zenith");
    expect(previewLabel("xi - Blue Zenith", true)).toBe("Stop preview of xi - Blue Zenith");
    expect(songOf({ artist: "xi", title: "Blue Zenith" }, 1)).toBe("xi - Blue Zenith");
    expect(songOf(undefined, 658127)).toBe("Beatmap 658127");
  });
});
