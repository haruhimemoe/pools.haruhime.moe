/**
 * @file tests/unit/utils/map-record.test.ts
 * @desc Map rows: seeded from otdb's export (no stars, set host without id), filled from the
 *       mirror's BeatmapMeta, search text over artist, title, set host and difficulty, a title
 *       sort key that puts unknown titles last, and the map label pages show.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import type { BeatmapMeta } from "@haruhimemoe/osu/shapes";
import { describe, expect, it } from "vitest";
import { mapLabel, mirrorFields, seededMap, sortTitleOf } from "@/utils/map-record";

const NOW = new Date("2026-09-24T12:00:00.000Z");

const SEED = {
  setId: 460580,
  artist: "ChouCho",
  title: "bouquet",
  setHost: "Kibbleru",
  version: "Sotarks' Extra",
  ar: 9.2,
  od: 8.2,
  cs: 4.2,
  hp: 6.2,
  length: 260,
  bpm: 192,
};

describe("seededMap", () => {
  it("keeps what otdb says, with no stars, no set host id and no uses yet", () => {
    expect(seededMap(989603, SEED, NOW)).toEqual({
      _id: 989603,
      ...SEED,
      setHostId: null,
      mode: "osu",
      stars: null,
      checksum: null,
      metaSource: "otdb",
      searchText: "choucho\nbouquet\nkibbleru\nsotarks' extra",
      sortTitle: "bouquet",
      usage: { count: 0, lastYear: null, playedAs: [], shown: false },
      updatedAt: NOW,
    });
  });
});

describe("mirrorFields", () => {
  it("takes the mirror's no-mod values and marks the map filled", () => {
    const meta: BeatmapMeta = {
      beatmapId: 129891,
      beatmapsetId: 39804,
      mode: "osu",
      title: "FREEDOM DiVE",
      artist: "xi",
      version: "FOUR DIMENSIONS",
      creator: "Nakagawa-Kanon",
      creatorId: 87065,
      cs: 4,
      ar: 9,
      od: 8,
      hp: 6,
      bpm: 222.22,
      lengthSeconds: 258,
      starRating: 7.81,
      checksum: "da8aae79c8f3306b5d65ec951874a7fb",
    };
    expect(mirrorFields(meta, NOW)).toEqual({
      setId: 39804,
      artist: "xi",
      title: "FREEDOM DiVE",
      version: "FOUR DIMENSIONS",
      setHost: "Nakagawa-Kanon",
      setHostId: 87065,
      mode: "osu",
      ar: 9,
      od: 8,
      cs: 4,
      hp: 6,
      length: 258,
      bpm: 222.22,
      stars: 7.81,
      checksum: "da8aae79c8f3306b5d65ec951874a7fb",
      metaSource: "mirror",
      searchText: "xi\nfreedom dive\nnakagawa-kanon\nfour dimensions",
      sortTitle: "freedom dive",
      updatedAt: NOW,
    });
  });
});

describe("sortTitleOf and mapLabel", () => {
  it("puts unknown titles last", () => {
    expect(sortTitleOf(null) > sortTitleOf("zzz")).toBe(true);
    expect(sortTitleOf("  ")).toBe(sortTitleOf(null));
  });

  it("labels a map by artist, title and difficulty, or by id", () => {
    expect(
      mapLabel({ artist: "xi", title: "FREEDOM DiVE", version: "FOUR DIMENSIONS" }, 129891),
    ).toBe("xi - FREEDOM DiVE [FOUR DIMENSIONS]");
    expect(mapLabel({ artist: null, title: "Song", version: null }, 5)).toBe(
      "Unknown artist - Song",
    );
    expect(mapLabel(undefined, 5)).toBe("Beatmap 5");
  });
});
