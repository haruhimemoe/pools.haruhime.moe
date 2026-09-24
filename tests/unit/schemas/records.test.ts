/**
 * @file tests/unit/schemas/records.test.ts
 * @desc Stored pool and map rows parse when whole and are refused (null) when a field that ends
 *       up in a URL, an href or an index is off: the pool id, a pack slug, a source link that
 *       isn't https, an unknown sync state, a played-as code or meta source nobody writes.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { describe, expect, it } from "vitest";
import { parseStoredMap } from "@/schemas/map";
import { emptyPackSync, parseStoredPool } from "@/schemas/pool";
import { makeMap, makePool } from "../../helpers/records";

describe("parseStoredPool", () => {
  it("parses a whole record", () => {
    const pool = makePool({ badged: true, notes: "HD optional." });
    expect(parseStoredPool(pool)).toEqual(pool);
  });

  it.each([
    ["an id with capitals", { _id: "OTDB-1" }],
    [
      "a pack slug with a slash",
      { pack: { ...emptyPackSync(), slug: "a/b", state: "created" as const } },
    ],
    [
      "an http source link",
      {
        sources: [
          {
            kind: "otdb" as const,
            id: "1",
            url: "http://otdb.sheppsu.me/db/mappools/1/",
            importedAt: new Date(),
          },
        ],
      },
    ],
    ["a sync state nobody writes", { pack: { ...emptyPackSync(), state: "pending" } }],
    ["a fingerprint that isn't sha256", { fingerprint: "abc" }],
  ])("refuses %s", (_label, overrides) => {
    expect(parseStoredPool({ ...makePool(), ...overrides })).toBeNull();
  });
});

describe("parseStoredMap", () => {
  it("parses a whole row, and one the mirror hasn't filled", () => {
    expect(parseStoredMap(makeMap({ _id: 1 }))).toEqual(makeMap({ _id: 1 }));
    const seeded = makeMap({ _id: 2, stars: null, setHostId: null, metaSource: "otdb" });
    expect(parseStoredMap(seeded)).toEqual(seeded);
  });

  it.each([
    [
      "a played-as code nobody writes",
      { usage: { count: 1, lastYear: null, playedAs: ["SD"], shown: true } },
    ],
    ["a meta source nobody writes", { metaSource: "osu" }],
    ["a zero beatmap id", { _id: 0 }],
  ])("refuses %s", (_label, overrides) => {
    expect(parseStoredMap({ ...makeMap({ _id: 1 }), ...overrides })).toBeNull();
  });
});
