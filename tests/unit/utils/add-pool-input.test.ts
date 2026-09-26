/**
 * @file tests/unit/utils/add-pool-input.test.ts
 * @desc What an admin pastes as an added pool's maps: a packs /k#pk1. link or a bare key (the
 *       pack's slots and custom slot mods as they are), a damaged key (packs' own message), a
 *       /p/<slug> link (refused: pools can't read a pack by its slug), "NM1 129891" lines with
 *       custom slots like HDHR1, bare IDs and difficulty links (maps without a slot), comments,
 *       65 maps, a slot twice and nothing at all. And the added pool's name: tournament, year and
 *       round, parts left out when empty, cut at a space at or before 64 characters.
 * @author David @dvhsh (https://dvh.sh)
 * @created Fri Sep 25, 2026
 * @modified Fri Sep 25, 2026
 */

import { encodePackKey, PACK_KEY_ERROR_MESSAGES } from "@haruhimemoe/pool";
import { describe, expect, it } from "vitest";
import { addedPoolName, readAddPoolMaps } from "@/utils/add-pool-input";

const KEY = encodePackKey({
  name: "Spring Cup Finals",
  slots: [
    { mod: "NM", index: 1, beatmapId: 129891 },
    { mod: "HD", index: 1, beatmapId: 75 },
  ],
});

/** A pk3 key: a custom "SV" slot forcing DT, which its code doesn't spell. */
const CUSTOM_KEY = encodePackKey({
  name: "Speed Cup",
  slots: [
    { mod: "NM", index: 1, beatmapId: 1 },
    { mod: "SV", index: 1, beatmapId: 2 },
  ],
  buckets: [
    { code: "NM" },
    { code: "HD" },
    { code: "HR" },
    { code: "DT" },
    { code: "FM" },
    { code: "SV", color: 0, mods: { kind: "forced", set: ["DT"] } },
    { code: "TB" },
  ],
});

describe("readAddPoolMaps", () => {
  it.each([
    ["a packs /k link", `https://packs.haruhime.moe/k#${KEY}`],
    ["a bare key", `  ${KEY}\n`],
  ])("reads %s as the pack's slots", (_label, text) => {
    const read = readAddPoolMaps(text);
    expect(read).toMatchObject({
      ok: true,
      from: "key",
      slots: [
        { label: "NM1", beatmapId: 129891 },
        { label: "HD1", beatmapId: 75 },
      ],
    });
    expect(read.ok && read.shape?.slots).toHaveLength(2);
  });

  it("keeps a key's custom slot mods in its shape", () => {
    const read = readAddPoolMaps(CUSTOM_KEY);
    expect(read.ok && read.slots.map(({ label }) => label)).toEqual(["NM1", "SV1"]);
    expect(read.ok && read.shape?.buckets).toContainEqual({
      code: "SV",
      color: 0,
      mods: { kind: "forced", set: ["DT"] },
    });
  });

  it("says what's wrong with a damaged key and reads nothing else", () => {
    expect(readAddPoolMaps(`${KEY.slice(0, -3)}zzz\nNM1 129891`)).toEqual({
      ok: false,
      message: PACK_KEY_ERROR_MESSAGES.checksum,
    });
  });

  it("refuses a pack's /p/ link and asks for the key", () => {
    const read = readAddPoolMaps("https://packs.haruhime.moe/p/Ab3_x-9QzP");
    expect(read).toEqual({
      ok: false,
      message:
        "pools can't read a pack from its /p/ link. Paste the pack key or the pack's /k link instead.",
    });
  });

  it("reads slot lines with custom slots, skipping comments", () => {
    const read = readAddPoolMaps(
      "# Grand Finals\nNM1 129891\nHD1: https://osu.ppy.sh/b/75\nHDHR1 2000001\nTB 3",
    );
    expect(read).toEqual({
      ok: true,
      from: "paste",
      slots: [
        { label: "NM1", beatmapId: 129891 },
        { label: "HD1", beatmapId: 75 },
        { label: "HDHR1", beatmapId: 2000001 },
        { label: "TB1", beatmapId: 3 },
      ],
      shape: null,
    });
  });

  it("reads bare IDs and difficulty links as maps without a slot", () => {
    const read = readAddPoolMaps(
      "129891, 75\nhttps://osu.ppy.sh/beatmapsets/39804#osu/129891\n2000001",
    );
    expect(read.ok && read.slots).toEqual([
      { label: "1", beatmapId: 129891 },
      { label: "2", beatmapId: 75 },
      { label: "3", beatmapId: 129891 },
      { label: "4", beatmapId: 2000001 },
    ]);
  });

  it("refuses 65 maps", () => {
    const text = Array.from({ length: 65 }, (_, i) => String(1000 + i)).join("\n");
    expect(readAddPoolMaps(text)).toEqual({
      ok: false,
      message: "A pool holds at most 64 maps; this has 65.",
    });
  });

  it("names every line it can't read", () => {
    expect(readAddPoolMaps("NM1 129891\nNM1 75\nhello there")).toEqual({
      ok: false,
      message:
        "Line 2: NM1 appears more than once. Line 3: Paste a beatmap ID or an osu.ppy.sh beatmap link.",
    });
  });

  it("asks for the maps when there are none", () => {
    expect(readAddPoolMaps(" \n# nothing\n")).toEqual({
      ok: false,
      message:
        "Paste the maps: a packs link, a pack key, or beatmap IDs or links with their slots.",
    });
  });
});

describe("addedPoolName", () => {
  it("joins tournament, year and round, leaving out what's empty", () => {
    expect(addedPoolName({ tournament: "Spring Cup", year: 2026, round: "Grand Finals" })).toBe(
      "Spring Cup 2026 Grand Finals",
    );
    expect(addedPoolName({ tournament: "Spring Cup", year: null, round: null })).toBe("Spring Cup");
    expect(addedPoolName({ tournament: "  Spring   Cup ", year: null, round: " QF " })).toBe(
      "Spring Cup QF",
    );
  });

  it("cuts at the last space at or before 64 characters", () => {
    const name = addedPoolName({
      tournament: "The Very Long Name Of A Tournament That Goes On",
      year: 2026,
      round: "Group Stage Week Two Day Three",
    });
    expect(name).toBe("The Very Long Name Of A Tournament That Goes On 2026 Group Stage");
    expect(name.length).toBeLessThanOrEqual(64);
  });

  it("cuts a name with no space in reach at 64 characters", () => {
    expect(addedPoolName({ tournament: "x".repeat(100), year: null, round: null })).toBe(
      "x".repeat(64),
    );
  });
});
