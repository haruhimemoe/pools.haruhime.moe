/**
 * @file tests/unit/utils/check-input.test.ts
 * @desc What /check reads from a paste: a pack key wins (a damaged one shows its error even next
 *       to good IDs), then a pasted pool (slot lines, "#" comments skipped, bad lines listed),
 *       then bare IDs and links (duplicates once, a set link explained); at most 64 maps.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { BEATMAP_REF_MESSAGES, encodePackKey, PACK_KEY_ERROR_MESSAGES } from "@haruhimemoe/pool";
import { describe, expect, it } from "vitest";
import { checkIds, readCheckInput } from "@/utils/check-input";

const KEY = encodePackKey({
  name: "Spring Cup Finals",
  slots: [
    { mod: "NM", index: 1, beatmapId: 129891 },
    { mod: "HD", index: 1, beatmapId: 75 },
  ],
});

describe("readCheckInput", () => {
  it("reads a pack key first, even inside a link or next to IDs", () => {
    expect(readCheckInput(`123 https://packs.haruhime.moe/k#${KEY} 456`)).toEqual({
      kind: "key",
      name: "Spring Cup Finals",
      rows: [
        { label: "NM1", beatmapId: 129891 },
        { label: "HD1", beatmapId: 75 },
      ],
      problems: [],
    });
  });

  it("shows a damaged key's error, however many good IDs sit next to it", () => {
    expect(readCheckInput(`${KEY.slice(0, -3)}zzz 129891 75`)).toEqual({
      kind: "empty",
      problems: [PACK_KEY_ERROR_MESSAGES.checksum],
    });
  });

  it("reads a pasted pool, skipping comments and listing bad lines", () => {
    expect(readCheckInput("# Finals\nNM1 129891\nHD1 https://osu.ppy.sh/b/75\nDT1 nope")).toEqual({
      kind: "pool",
      name: null,
      rows: [
        { label: "NM1", beatmapId: 129891 },
        { label: "HD1", beatmapId: 75 },
      ],
      problems: [expect.stringMatching(/^Line 4: /)],
    });
  });

  it("reads bare IDs and links once each, and explains a set link", () => {
    const input = readCheckInput(
      "129891, 75\nhttps://osu.ppy.sh/beatmapsets/39804#osu/129891\n# 5\nhttps://osu.ppy.sh/beatmapsets/39804",
    );
    expect(input).toEqual({
      kind: "ids",
      name: null,
      rows: [
        { label: null, beatmapId: 129891 },
        { label: null, beatmapId: 75 },
      ],
      problems: [`https://osu.ppy.sh/beatmapsets/39804: ${BEATMAP_REF_MESSAGES["set-only"]}`],
    });
    expect(checkIds(input)).toEqual([75, 129891]);
  });

  it("checks at most 64 maps", () => {
    const input = readCheckInput(Array.from({ length: 70 }, (_, i) => i + 1).join(" "));
    expect(input.kind === "ids" && input.rows).toHaveLength(64);
    expect(input.problems).toEqual(["Only the first 64 maps are checked."]);
  });

  it("reads nothing as empty", () => {
    expect(readCheckInput("  \n# only a comment\n")).toEqual({ kind: "empty", problems: [] });
  });
});
