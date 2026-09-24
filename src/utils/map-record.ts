/**
 * @file src/utils/map-record.ts
 * @desc Map rows: one seeded from otdb's export (set, artist, title, set host, difficulty name,
 *       AR/OD/CS/HP, length and BPM, all without mods; no stars, since otdb's carry mods), the
 *       fields the mirror fills (its BeatmapMeta: no-mod stars, set host id, checksum), the
 *       folded search text (artist, title, set host, difficulty), a title sort key that puts
 *       unknown titles last, and the label pages show for a map. Pure.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import type { BeatmapMeta } from "@haruhimemoe/osu/shapes";
import type { StoredMap } from "@/schemas/map";
import { foldForSearch, searchTextOf } from "@/utils/fold";

/** What otdb's export says about a map. */
export type MapSeed = {
  setId: number;
  artist: string;
  title: string;
  setHost: string;
  version: string;
  ar: number;
  od: number;
  cs: number;
  hp: number;
  length: number;
  bpm: number;
};

type MapText = {
  artist: string | null;
  title: string | null;
  setHost: string | null;
  version: string | null;
};

/**
 * @function mapSearchText
 * @param map {MapText} a map's text fields
 * @returns {string} artist, title, set host and difficulty, folded, one per line
 */
export const mapSearchText = (map: MapText): string =>
  searchTextOf(map.artist, map.title, map.setHost, map.version);

/** Sorts after every folded title. */
const LAST = "￿";

/**
 * @function sortTitleOf
 * @param title {string | null} a map's title
 * @returns {string} the folded title, or a key after every title when there is none
 */
export const sortTitleOf = (title: string | null): string =>
  title === null || title.trim() === "" ? LAST : foldForSearch(title);

/**
 * @function seededMap
 * @param id {number} the beatmap (difficulty) id
 * @param seed {MapSeed} what the export says
 * @param now {Date} the import's clock
 * @returns {StoredMap} a new row: otdb's values, no stars, no uses yet
 */
export const seededMap = (id: number, seed: MapSeed, now: Date): StoredMap => ({
  _id: id,
  setId: seed.setId,
  artist: seed.artist,
  title: seed.title,
  version: seed.version,
  setHost: seed.setHost,
  setHostId: null,
  mode: "osu",
  ar: seed.ar,
  od: seed.od,
  cs: seed.cs,
  hp: seed.hp,
  length: seed.length,
  bpm: seed.bpm,
  stars: null,
  checksum: null,
  metaSource: "otdb",
  searchText: mapSearchText(seed),
  sortTitle: sortTitleOf(seed.title),
  usage: { count: 0, lastYear: null, playedAs: [], shown: false },
  updatedAt: now,
});

/**
 * @function mirrorFields
 * @param meta {BeatmapMeta} the mirror's answer for the map
 * @param now {Date} the import's clock
 * @returns the fields to set: every value the mirror gives, the map marked filled
 */
export const mirrorFields = (meta: BeatmapMeta, now: Date) => ({
  setId: meta.beatmapsetId,
  artist: meta.artist,
  title: meta.title,
  version: meta.version,
  setHost: meta.creator,
  setHostId: meta.creatorId,
  mode: meta.mode,
  ar: meta.ar,
  od: meta.od,
  cs: meta.cs,
  hp: meta.hp,
  length: meta.lengthSeconds,
  bpm: meta.bpm,
  stars: meta.starRating,
  checksum: meta.checksum,
  metaSource: "mirror" as const,
  searchText: mapSearchText({
    artist: meta.artist,
    title: meta.title,
    setHost: meta.creator,
    version: meta.version,
  }),
  sortTitle: sortTitleOf(meta.title),
  updatedAt: now,
});

/**
 * @function mapLabel
 * @param map {{ artist: string | null; title: string | null; version: string | null } | null | undefined} a map
 * @param id {number} its beatmap id
 * @returns {string} "Artist - Title [Difficulty]", or "Beatmap <id>" when the title isn't known
 */
export const mapLabel = (
  map: { artist: string | null; title: string | null; version: string | null } | null | undefined,
  id: number,
): string => {
  if (!map?.title) return `Beatmap ${id}`;
  const version = map.version ? ` [${map.version}]` : "";
  return `${map.artist ?? "Unknown artist"} - ${map.title}${version}`;
};
