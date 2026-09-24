/**
 * @file tests/unit/utils/fingerprint.test.ts
 * @desc What each slot plays with, and pool fingerprints: sha256 of the sorted
 *       "beatmapId:mods" lines, the same whatever the slot order, labels or colors, different
 *       when a map or its mods change, and custom slots written by what they play with.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { createHash } from "node:crypto";
import { type BucketEntry, type PoolSlot, slotKey } from "@haruhimemoe/pool";
import { describe, expect, it } from "vitest";
import { fingerprintText, poolFingerprint } from "@/utils/fingerprint";
import { slotModsCode, slotModsMap } from "@/utils/slot-mods";

const WITH_CUSTOMS: BucketEntry[] = [
  { code: "NM" },
  { code: "HD" },
  { code: "HR" },
  { code: "DT" },
  { code: "FM" },
  { code: "HDHR", color: 0, mods: { kind: "forced", set: ["HD", "HR"] } },
  { code: "X", color: 1, mods: { kind: "free" } },
  { code: "S", color: 2 },
  { code: "Hidden", color: 3, mods: { kind: "forced", set: ["HD"] } },
  { code: "TB" },
];

const slots: PoolSlot[] = [
  { mod: "NM", index: 1, beatmapId: 1 },
  { mod: "HD", index: 1, beatmapId: 2 },
  { mod: "TB", index: 1, beatmapId: 3 },
];

describe("slotModsCode", () => {
  const mods = slotModsMap(
    [
      { mod: "HD", index: 1, beatmapId: 1 },
      { mod: "HDHR", index: 1, beatmapId: 2 },
      { mod: "X", index: 1, beatmapId: 3 },
      { mod: "S", index: 1, beatmapId: 4 },
      { mod: null, index: 1, beatmapId: 5 },
    ],
    WITH_CUSTOMS,
  );

  it.each<[PoolSlot, string]>([
    [{ mod: "HD", index: 1, beatmapId: 1 }, "HD"],
    [{ mod: "HDHR", index: 1, beatmapId: 2 }, "HDHR"],
    [{ mod: "X", index: 1, beatmapId: 3 }, "FM"],
    [{ mod: "S", index: 1, beatmapId: 4 }, "NM"],
    [{ mod: null, index: 1, beatmapId: 5 }, "NM"],
  ])("writes %j as %s", (slot, code) => {
    expect(slotModsCode(slot, mods.get(slotKey(slot)))).toBe(code);
  });
});

describe("poolFingerprint", () => {
  it("is sha256 hex of fingerprintText", () => {
    expect(fingerprintText({ slots })).toBe("1:NM\n2:HD\n3:TB");
    expect(poolFingerprint({ slots })).toBe(
      createHash("sha256").update("1:NM\n2:HD\n3:TB", "utf8").digest("hex"),
    );
  });

  it("ignores slot order and slot numbers", () => {
    const print = poolFingerprint({ slots });
    expect(poolFingerprint({ slots: [...slots].reverse() })).toBe(print);
    expect(
      poolFingerprint({ slots: slots.map((slot) => ({ ...slot, index: slot.index + 4 })) }),
    ).toBe(print);
  });

  it("changes with the maps and with their mods", () => {
    const print = poolFingerprint({ slots });
    expect(poolFingerprint({ slots: [...slots, { mod: "HR", index: 1, beatmapId: 4 }] })).not.toBe(
      print,
    );
    expect(
      poolFingerprint({
        slots: slots.map((slot) => (slot.beatmapId === 2 ? { ...slot, mod: "HR" } : slot)),
      }),
    ).not.toBe(print);
  });

  it("writes custom slots by what they play with, so a label or color doesn't matter", () => {
    const hidden = { slots: [{ mod: "Hidden", index: 1, beatmapId: 2 }], buckets: WITH_CUSTOMS };
    expect(poolFingerprint(hidden)).toBe(
      poolFingerprint({ slots: [{ mod: "HD", index: 1, beatmapId: 2 }] }),
    );
    const free = { slots: [{ mod: "X", index: 1, beatmapId: 2 }], buckets: WITH_CUSTOMS };
    expect(poolFingerprint(free)).toBe(
      poolFingerprint({ slots: [{ mod: "FM", index: 1, beatmapId: 2 }] }),
    );
    const plain = { slots: [{ mod: "S", index: 1, beatmapId: 2 }], buckets: WITH_CUSTOMS };
    expect(poolFingerprint(plain)).toBe(
      poolFingerprint({ slots: [{ mod: null, index: 1, beatmapId: 2 }] }),
    );
  });
});
