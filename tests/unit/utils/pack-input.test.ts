/**
 * @file tests/unit/utils/pack-input.test.ts
 * @desc What pools sends packs: the name, a description linking back (tournament, round, year,
 *       whichever are known), public or unlisted (hidden or superseded), slots and buckets
 *       without stored extras; the input hash (changes with anything packs sees, never with
 *       notes or badged, not with slot order); the pack key; and "Open in packs".
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { type BucketEntry, decodePackKey } from "@haruhimemoe/pool";
import { describe, expect, it } from "vitest";
import { emptyPackSync } from "@/schemas/pool";
import {
  openInPacksHref,
  packDescription,
  packInputHash,
  packInputOf,
  packKeyOf,
} from "@/utils/pack-input";
import { makePool } from "../../helpers/records";

const OWC = makePool({
  _id: "otdb-657",
  name: "osu! World Cup 2023 Grand Finals",
  slots: [
    { mod: "NM", index: 1, beatmapId: 1 },
    { mod: "DT", index: 1, beatmapId: 2 },
  ],
});

describe("packDescription", () => {
  it.each([
    [
      { tournament: "osu! World Cup", round: "Grand Finals", year: 2023 },
      "osu! World Cup Grand Finals (2023). Pool details and sources: https://pools.haruhime.moe/pools/otdb-657",
    ],
    [
      { tournament: "Spring Cup", round: null, year: 2020 },
      "Spring Cup (2020). Pool details and sources: https://pools.haruhime.moe/pools/otdb-657",
    ],
    [
      { tournament: "Aeris 100k-160k February", round: null, year: null },
      "Aeris 100k-160k February. Pool details and sources: https://pools.haruhime.moe/pools/otdb-657",
    ],
  ])("writes %j", (fields, text) => {
    expect(packDescription({ _id: "otdb-657", ...fields })).toBe(text);
  });
});

describe("packInputOf", () => {
  it("sends the name, description, visibility and bare slots", () => {
    const stored = { ...OWC, slots: OWC.slots.map((slot) => ({ ...slot, extra: 1 })) };
    expect(packInputOf(stored)).toEqual({
      name: "osu! World Cup 2023 Grand Finals",
      description: packDescription(OWC),
      visibility: "public",
      slots: OWC.slots,
    });
  });

  it("unlists hidden and superseded pools, and sends buckets only when there are some", () => {
    expect(packInputOf({ ...OWC, hidden: true }).visibility).toBe("unlisted");
    expect(packInputOf({ ...OWC, supersededBy: "otdb-657-2" }).visibility).toBe("unlisted");
    const buckets: BucketEntry[] = [
      { code: "NM" },
      { code: "HD" },
      { code: "HR" },
      { code: "DT" },
      { code: "FM" },
      { code: "EZ", color: 0, mods: { kind: "forced", set: ["EZ"] } },
      { code: "TB" },
    ];
    expect(packInputOf({ ...OWC, buckets }).buckets).toEqual(buckets);
  });
});

describe("packInputHash", () => {
  const hash = packInputHash(packInputOf(OWC));

  it("is stable, and ignores slot order, notes and badged", () => {
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(packInputHash(packInputOf({ ...OWC, slots: [...OWC.slots].reverse() }))).toBe(hash);
    const noted = { ...OWC, notes: "New notes", badged: true };
    expect(packInputHash(packInputOf(noted))).toBe(hash);
  });

  it("changes with the name, round, year, visibility and maps", () => {
    for (const changed of [
      { ...OWC, name: "osu! World Cup 2023 Finals" },
      { ...OWC, round: "Finals" },
      { ...OWC, year: null },
      { ...OWC, hidden: true },
      { ...OWC, slots: [{ mod: "NM", index: 1, beatmapId: 3 }] },
    ]) {
      expect(packInputHash(packInputOf(changed))).not.toBe(hash);
    }
  });
});

describe("packKeyOf and openInPacksHref", () => {
  it("builds a key that decodes to the pool", () => {
    expect(decodePackKey(packKeyOf(OWC))).toMatchObject({
      name: OWC.name,
      slots: OWC.slots,
    });
  });

  it("links the pack while packs lists it, else the key", () => {
    const listed = {
      ...emptyPackSync(),
      slug: "Ab3_x-9QzP",
      state: "created" as const,
      listed: true,
    };
    expect(openInPacksHref({ ...OWC, pack: listed })).toBe(
      "https://packs.haruhime.moe/p/Ab3_x-9QzP",
    );
    const key = `https://packs.haruhime.moe/k#${packKeyOf(OWC)}`;
    expect(openInPacksHref({ ...OWC, pack: { ...listed, listed: false } })).toBe(key);
    expect(openInPacksHref({ ...OWC, pack: { ...listed, state: "error" } })).toBe(key);
    expect(openInPacksHref({ ...OWC, pack: { ...listed, state: "gone" } })).toBe(key);
    expect(openInPacksHref({ ...OWC, pack: emptyPackSync() })).toBe(key);
  });
});
