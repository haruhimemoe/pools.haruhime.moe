/**
 * @file tests/helpers/records.ts
 * @desc Complete, valid pool and map records for tests: makePool and makeMap fill every field
 *       (derived ones from the name and slots) and take overrides. T0 is the tests' fixed clock.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import type { StoredMap } from "@/schemas/map";
import { emptyPackSync, type StoredPool } from "@/schemas/pool";
import { poolFingerprint } from "@/utils/fingerprint";
import { mapSearchText, sortTitleOf } from "@/utils/map-record";
import { derivedFields, effectiveFields, isVisible } from "@/utils/pool-record";

export const T0 = new Date("2026-09-24T12:00:00.000Z");

/**
 * @function makePool
 * @param overrides {Partial<StoredPool>} fields to set
 * @returns {StoredPool} a current, visible otdb pool ("Spring Cup 2020 Finals", one NM map) with
 *          the overrides; tournament, round, year, key, search text and fingerprint follow the
 *          name, edits and slots unless overridden; visible follows hidden and supersededBy
 */
export const makePool = (overrides: Partial<StoredPool> = {}): StoredPool => {
  const name = overrides.name ?? "Spring Cup 2020 Finals";
  const edited = overrides.edited ?? {};
  const slots = overrides.slots ?? [{ mod: "NM", index: 1, beatmapId: 1001 }];
  const fields = effectiveFields(name, edited);
  const id = overrides._id ?? "otdb-1";
  const sourceId = id.replace(/^otdb-/, "").replace(/-\d+$/, "");
  const merged: StoredPool = {
    _id: id,
    name,
    ...fields,
    edited,
    ...derivedFields(name, fields),
    badged: null,
    notes: "",
    sourceSlots: slots.map((slot) => ({
      label: `${slot.mod ?? "#"}${slot.index}`,
      beatmapId: slot.beatmapId,
      mods: [],
    })),
    slots,
    fingerprint: poolFingerprint({ slots, buckets: overrides.buckets }),
    sources: [
      {
        kind: "otdb",
        id: sourceId,
        url: `https://otdb.sheppsu.me/db/mappools/${sourceId}/`,
        importedAt: T0,
      },
    ],
    formerSources: [],
    stats: {
      srMin: 5,
      srMax: 5,
      lenMin: 120,
      lenMax: 120,
      bpmMin: 180,
      bpmMax: 180,
      count: slots.length,
      complete: true,
    },
    supersededBy: null,
    hidden: false,
    visible: true,
    pack: emptyPackSync(),
    createdAt: T0,
    updatedAt: T0,
    ...overrides,
  };
  if (merged.buckets === undefined) delete merged.buckets;
  return { ...merged, visible: overrides.visible ?? isVisible(merged) };
};

/**
 * @function makeMap
 * @param overrides {Partial<StoredMap> & { _id: number }} the beatmap id and fields to set
 * @returns {StoredMap} a mirror-filled osu! map used in one 2020 pool as NM, with the overrides;
 *          searchText and sortTitle follow the text fields unless overridden
 */
export const makeMap = (overrides: Partial<StoredMap> & { _id: number }): StoredMap => {
  const text = {
    artist: overrides.artist === undefined ? "Artist" : overrides.artist,
    title: overrides.title === undefined ? `Title ${overrides._id}` : overrides.title,
    setHost: overrides.setHost === undefined ? "Host" : overrides.setHost,
    version: overrides.version === undefined ? "Insane" : overrides.version,
  };
  return {
    setId: 1,
    ...text,
    setHostId: 2,
    mode: "osu",
    ar: 9,
    od: 8,
    cs: 4,
    hp: 6,
    length: 120,
    bpm: 180,
    stars: 5.5,
    checksum: null,
    metaSource: "mirror",
    searchText: mapSearchText(text),
    sortTitle: sortTitleOf(text.title),
    usage: { count: 1, lastYear: 2020, playedAs: ["NM"], shown: true },
    updatedAt: T0,
    ...overrides,
  };
};
