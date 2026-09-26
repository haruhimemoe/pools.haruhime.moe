/**
 * @file tests/unit/schemas/records.test.ts
 * @desc Stored pool and map rows parse when whole and are refused (null) when a field that ends
 *       up in a URL, an href or an index is off: the pool id, a pack slug, a source link that
 *       isn't https, an unknown sync state, a played-as code or meta source nobody writes. Every
 *       source kind parses: a v1 otdb row as stored, host and community sources with a credit
 *       (with or without its link, the key left out) and former sources with leftAt; a credit
 *       with an http, javascript: or null link, an empty, 101-character or filtered name, or a
 *       generated id of the wrong shape is refused.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Fri Sep 25, 2026
 */

import { describe, expect, it } from "vitest";
import { parseStoredMap } from "@/schemas/map";
import { emptyPackSync, parseStoredPool, sourceCreditSchema } from "@/schemas/pool";
import { makeMap, makePool, T0 } from "../../helpers/records";

/** A pool row as v1 stored it: one otdb source with its link, nothing else. */
const V1_ROW = {
  ...makePool({ _id: "otdb-657" }),
  sources: [
    {
      kind: "otdb",
      id: "657",
      url: "https://otdb.sheppsu.me/db/mappools/657/",
      importedAt: T0,
    },
  ],
  formerSources: [
    {
      kind: "otdb",
      id: "656",
      url: "https://otdb.sheppsu.me/db/mappools/656/",
      importedAt: T0,
      leftAt: T0,
    },
  ],
};

const hostSource = (credit: Record<string, unknown>, id = "h1b2c3d4") => ({
  kind: "host",
  id,
  credit,
  importedAt: T0,
});

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
    ["a source kind nobody writes", { sources: [{ ...V1_ROW.sources[0], kind: "otr" }] }],
    ["an otdb source without its link", { sources: [{ kind: "otdb", id: "1", importedAt: T0 }] }],
  ])("refuses %s", (_label, overrides) => {
    expect(parseStoredPool({ ...makePool(), ...overrides })).toBeNull();
  });

  it("still parses a v1 otdb row, earlier versions included", () => {
    const parsed = parseStoredPool(V1_ROW);
    expect(parsed?.sources).toEqual(V1_ROW.sources);
    expect(parsed?.formerSources).toEqual(V1_ROW.formerSources);
  });

  it("parses host and community sources with a credit, the link optional", () => {
    const sources = [
      hostSource({ name: "Spring Cup hosts", url: "https://osu.ppy.sh/community/forums/topics/1" }),
      hostSource({ name: "Autumn Cup staff" }, "hz9y8x7w"),
      { kind: "community", id: "c0000000", credit: { name: "peppy" }, importedAt: T0 },
    ];
    const formerSources = [{ ...hostSource({ name: "Old hosts" }, "ha1a1a1a"), leftAt: T0 }];
    const parsed = parseStoredPool({ ...makePool(), sources, formerSources });
    expect(parsed?.sources).toEqual(sources);
    expect(parsed?.formerSources).toEqual(formerSources);
    expect(parsed?.sources[1]).not.toHaveProperty("credit.url");
  });

  it.each([
    ["an http credit link", hostSource({ name: "Hosts", url: "http://example.com/sheet" })],
    ["a javascript: credit link", hostSource({ name: "Hosts", url: "javascript:alert(1)" })],
    ["a null credit link", hostSource({ name: "Hosts", url: null })],
    ["an empty credit name", hostSource({ name: "   " })],
    ["a 101-character credit name", hostSource({ name: "a".repeat(101) })],
    ["a credit name the content filter refuses", hostSource({ name: "retard hosts" })],
    ["a credit name with a line break", hostSource({ name: "Spring\nCup" })],
    ["no credit", { kind: "host", id: "h1b2c3d4", importedAt: T0 }],
    ["an all-digit generated id", hostSource({ name: "Hosts" }, "12345678")],
    ["a generated id with capitals", hostSource({ name: "Hosts" }, "hABCDEFG")],
    ["a generated id of the wrong length", hostSource({ name: "Hosts" }, "h1b2c3")],
  ])("refuses a host source with %s", (_label, source) => {
    expect(parseStoredPool({ ...makePool(), sources: [source] })).toBeNull();
  });
});

describe("sourceCreditSchema", () => {
  it("trims the name and leaves the link out when there is none", () => {
    expect(sourceCreditSchema.parse({ name: "  Spring Cup hosts  " })).toEqual({
      name: "Spring Cup hosts",
    });
  });

  it("takes names of 1 and 100 characters", () => {
    expect(sourceCreditSchema.safeParse({ name: "a" }).success).toBe(true);
    expect(sourceCreditSchema.safeParse({ name: "a".repeat(100) }).success).toBe(true);
    expect(sourceCreditSchema.safeParse({ name: ` ${"a".repeat(100)} ` }).success).toBe(true);
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
