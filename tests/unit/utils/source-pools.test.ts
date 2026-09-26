/**
 * @file tests/unit/utils/source-pools.test.ts
 * @desc Source pools to pool records: custom slot mods from their codes, labels through the
 *       pasted-pool parser (numbered maps, custom labels, every way a pool is refused), the
 *       source's mods (a rating mod every map under a label carries goes into the slot; a
 *       no-mod slot or maps without a slot whose mods can't be held skip the pool; the real EZ
 *       pools otdb #642 and #669), the content filter on the name, labels and notes, notes
 *       cleanup, and id order (otdb's numeric ids before the generated host and community ids,
 *       whose credit rides along). (Blocked text below is a test input only.)
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Fri Sep 25, 2026
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { poolFingerprint } from "@/utils/fingerprint";
import { otdbSource, readOtdbExport } from "@/utils/otdb";
import {
  bySourceId,
  modsFromSlotCode,
  normalizeNotes,
  normalizePool,
  normalizePools,
  poolFromLabels,
  type SourcePool,
} from "@/utils/source-pools";

const labelled = (...labels: string[]) =>
  labels.map((label, i) => ({ label, beatmapId: 1000 + i }));

const source = (id: number, name: string, labels: string[], notes = ""): SourcePool => ({
  source: otdbSource(id),
  name,
  notes,
  slots: labelled(...labels),
});

describe("modsFromSlotCode", () => {
  it.each([
    ["EZ", ["EZ"]],
    ["HDHR", ["HD", "HR"]],
    ["dthd", ["HD", "DT"]],
    ["HDHT", ["HD", "HT"]],
    ["EZHDDT", ["EZ", "HD", "DT"]],
  ])("reads %s", (code, set) => {
    expect(modsFromSlotCode(code)).toEqual(set);
  });

  it.each(["S", "C", "SV", "EZHR", "DTHT", "HDHD", "EZHDDTFL", "NM", "HD1", "FMHD"])(
    "gives no mods for %s",
    (code) => {
      expect(modsFromSlotCode(code)).toBeNull();
    },
  );
});

describe("poolFromLabels", () => {
  it("reads built-in labels, keeps the source's order, and adds no bucket list", () => {
    expect(
      poolFromLabels("Cup Finals", labelled("NM1", "hd2", "HR 1", "DT1", "FM1", "TB")),
    ).toEqual({
      ok: true,
      pool: {
        name: "Cup Finals",
        slots: [
          { mod: "NM", index: 1, beatmapId: 1000 },
          { mod: "HD", index: 2, beatmapId: 1001 },
          { mod: "HR", index: 1, beatmapId: 1002 },
          { mod: "DT", index: 1, beatmapId: 1003 },
          { mod: "FM", index: 1, beatmapId: 1004 },
          { mod: "TB", index: 1, beatmapId: 1005 },
        ],
      },
    });
  });

  it("makes custom slots, forcing the mods a code spells", () => {
    const result = poolFromLabels("EZ Cup", labelled("EZ1", "HDDT1", "S1", "C10", "TB1"));
    expect(result.ok && result.pool.buckets?.filter((entry) => "color" in entry)).toEqual([
      { code: "EZ", color: 0, mods: { kind: "forced", set: ["EZ"] } },
      { code: "HDDT", color: 1, mods: { kind: "forced", set: ["HD", "DT"] } },
      { code: "S", color: 2 },
      { code: "C", color: 3 },
    ]);
    expect(result.ok && result.pool.slots.map((slot) => `${slot.mod}${slot.index}`)).toEqual([
      "EZ1",
      "HDDT1",
      "S1",
      "C10",
      "TB1",
    ]);
  });

  it("reads numbered labels as maps without a slot, in place", () => {
    const result = poolFromLabels("Quals", labelled("#1", "#2", "NM1", "12"));
    expect(result.ok && result.pool.slots).toEqual([
      { mod: null, index: 1, beatmapId: 1000 },
      { mod: null, index: 2, beatmapId: 1001 },
      { mod: "NM", index: 1, beatmapId: 1002 },
      { mod: null, index: 12, beatmapId: 1003 },
    ]);
  });

  it.each([
    [["NM1", "DT1", "DT1"], "Slot DT1: DT1 appears more than once."],
    [["#1", "1"], "No slot 1 appears more than once."],
    [["NM1", ""], "A map has no slot label."],
    [["NM1\nHD1"], 'The slot label "NM1\\nHD1" has a line break.'],
    [["#0"], "Slot #0: slot numbers go from 1 to 99."],
    [["#100"], "Slot #100: slot numbers go from 1 to 99."],
    [["#A"], "A slot label couldn't be read."],
    [["NM0"], "Slot NM0: Slot numbers go from 1 to 99."],
    [["Tie Breaker"], "Slot Tie Breaker: Paste a beatmap ID or an osu.ppy.sh beatmap link."],
    [
      ["A1", "B1", "C1", "D1", "E1", "F1", "G1", "H1", "I1"],
      "Slot I1: This pool already has 8 custom slots.",
    ],
  ])("refuses %j: %s", (labels, reason) => {
    expect(poolFromLabels("Cup", labelled(...labels))).toEqual({ ok: false, reason });
  });
});

/** A pool whose maps carry the source's mods: [label, mods] per map. */
const withMods = (id: number, name: string, maps: [string, string[]][]): SourcePool => ({
  source: otdbSource(id),
  name,
  notes: "",
  slots: maps.map(([label, mods], i) => ({ label, beatmapId: 2000 + i, mods })),
});

const shapeOf = (pool: SourcePool) => {
  const result = normalizePool(pool);
  if (!result.ok) throw new Error(result.skipped.reason);
  return {
    buckets: result.pool.pool.buckets?.filter((entry) => "color" in entry) ?? [],
    slots: result.pool.pool.slots.map((slot) => `${slot.mod}${slot.index}`),
  };
};

const skipReason = (pool: SourcePool): string | null => {
  const result = normalizePool(pool);
  return result.ok ? null : result.skipped.reason;
};

describe("the source's mods", () => {
  it("puts a rating mod every map under a label carries into the slot (an EZ tournament)", () => {
    const { buckets, slots } = shapeOf(
      withMods(1, "EZ Cup Finals", [
        ["EZ1", ["EZ"]],
        ["HD1", ["EZ", "HD"]],
        ["HD2", ["HD", "EZ"]],
        ["DT1", ["EZ", "NC"]],
        ["HT1", ["EZ", "DC"]],
        ["TB1", ["EZ", "FM"]],
      ]),
    );
    expect(slots).toEqual(["EZ1", "EZHD1", "EZHD2", "EZDT1", "EZHT1", "TB1"]);
    expect(buckets.map((bucket) => bucket.code)).toEqual(["EZ", "EZHD", "EZDT", "EZHT"]);
  });

  it("forces a no-mod custom slot's mods when all its maps share them", () => {
    const { buckets } = shapeOf(
      withMods(2, "Cup Finals", [
        ["S1", ["EZ"]],
        ["S2", ["EZ", "HD"]],
        ["NM1", []],
      ]),
    );
    expect(buckets).toEqual([{ code: "S", color: 0, mods: { kind: "forced", set: ["EZ"] } }]);
  });

  it("lets the label decide when a built-in slot's maps disagree (otdb shares entries)", () => {
    expect(
      shapeOf(
        withMods(3, "Cup Finals", [
          ["NM1", ["HR"]],
          ["NM2", []],
          ["DT1", ["DT", "EZ"]],
          ["DT2", ["DT"]],
        ]),
      ),
    ).toEqual({ buckets: [], slots: ["NM1", "NM2", "DT1", "DT2"] });
  });

  it("lets the label decide for one map with a mod the rest of the pool doesn't carry", () => {
    const { slots } = shapeOf(
      withMods(4, "Cup Finals", [
        ["NM1", []],
        ["DT1", ["DT", "EZ"]],
      ]),
    );
    expect(slots).toEqual(["NM1", "DT1"]);
  });

  it("uses one map's mod when every map in the pool carries it", () => {
    const { slots } = shapeOf(
      withMods(5, "EZ Cup Finals", [
        ["EZ1", ["EZ"]],
        ["HDDT1", ["EZ", "HD", "DT"]],
      ]),
    );
    expect(slots).toEqual(["EZ1", "EZHDDT1"]);
  });

  it("changes nothing when the source gives no mods", () => {
    expect(shapeOf(source(9, "EZ Cup Finals", ["EZ1", "HD1"])).slots).toEqual(["EZ1", "HD1"]);
  });

  it.each([
    [
      withMods(6, "EZ World Cup Finals", [
        ["S1", ["EZ"]],
        ["S2", ["EZ", "DT", "FM"]],
        ["S3", ["EZ", "FM", "HT"]],
      ]),
      "Slot S: its maps are played with different mods (EZ, EZDT, EZHT), which one slot can't hold.",
    ],
    [
      withMods(7, "EZ World Cup Qualifiers", [
        ["#1", ["EZ", "FM", "HT"]],
        ["#2", ["EZ", "HD"]],
      ]),
      "Maps without a slot are played with mods (EZHT, EZ), which a map without a slot can't hold.",
    ],
    [
      withMods(8, "Cup Finals", [
        ["HR1", ["HR", "EZ"]],
        ["HR2", ["EZ", "HR"]],
      ]),
      "Slot HR: its maps are played with EZ too, and EZHR can't be forced together.",
    ],
  ])("skips %j", (pool, reason) => {
    expect(skipReason(pool)).toBe(reason);
  });
});

describe("the real EZ pools (otdb #642 and #669)", () => {
  const read = readOtdbExport(
    JSON.parse(
      readFileSync(path.join(process.cwd(), "tests", "fixtures", "otdb", "ez-pools.json"), "utf8"),
    ),
  );
  const { pools, skipped } = normalizePools(read.pools);

  it("imports Sheppsu's Super EZ Tournament Finals with EZ in every slot but the tiebreaker", () => {
    const [finals] = pools;
    expect(finals?.source.id).toBe("642");
    expect(finals?.pool.buckets?.filter((entry) => "color" in entry).map((b) => b.code)).toEqual([
      "EZ",
      "EZHD",
      "EZDT",
      "EZHDDT",
      "EZHT",
      "EZHDHT",
    ]);
    expect(finals?.pool.slots.find((slot) => slot.beatmapId === 3409173)).toEqual({
      mod: "EZDT",
      index: 1,
      beatmapId: 3409173,
    });
  });

  it("skips EZ World Cup Semifinals, whose S and C slots mix mods", () => {
    expect(pools).toHaveLength(1);
    expect(skipped.map((pool) => pool.id)).toEqual(["669"]);
  });
});

describe("normalizePool", () => {
  it("gives the canonical pool, the source's labels, the cleaned notes and the fingerprint", () => {
    const result = normalizePool(
      source(657, " osu! World Cup 2023 Grand Finals ", ["NM1", "DT1"], "HD optional.\r\n"),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.pool).toEqual({
      source: otdbSource(657),
      name: "osu! World Cup 2023 Grand Finals",
      notes: "HD optional.",
      sourceSlots: [
        { label: "NM1", beatmapId: 1000, mods: [] },
        { label: "DT1", beatmapId: 1001, mods: [] },
      ],
      pool: {
        name: "osu! World Cup 2023 Grand Finals",
        slots: [
          { mod: "NM", index: 1, beatmapId: 1000 },
          { mod: "DT", index: 1, beatmapId: 1001 },
        ],
      },
      fingerprint: poolFingerprint({
        slots: [
          { mod: "NM", index: 1, beatmapId: 1000 },
          { mod: "DT", index: 1, beatmapId: 1001 },
        ],
      }),
    });
  });

  it.each([
    ["a name over 64 characters", source(5, "x".repeat(65), ["NM1"]), /^name: Too big/],
    ["no maps", source(6, "Empty Cup", []), /^The pool has no maps\.$/],
    [
      "a blocked name",
      source(7, "Cup 1488 Finals", ["NM1"]),
      /^The pool name fails the content filter\.$/,
    ],
    [
      "a control character in the name",
      source(10, "Cup\u001b[2K Finals", ["NM1"]),
      /^The pool name has control characters\.$/,
    ],
    [
      "a blocked slot label",
      source(9, "Cup Finals", ["NM1", "HD1488"]),
      /^A slot label fails the content filter\.$/,
    ],
    [
      "blocked notes",
      source(11, "Cup Finals", ["NM1"], "Win condition 14/88."),
      /^The notes fail the content filter\.$/,
    ],
    [
      "notes over 2000 characters",
      source(12, "Cup Finals", ["NM1"], "x".repeat(2001)),
      /^The notes are longer than 2000 characters\.$/,
    ],
    [
      "a label the parser refuses",
      source(8, "Cup", ["NM1", "NM1"]),
      /^Slot NM1: NM1 appears more than once\.$/,
    ],
  ])("skips a pool with %s", (_label, pool, reason) => {
    const result = normalizePool(pool);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.skipped).toMatchObject({ kind: "otdb", id: pool.source.id, name: pool.name });
    expect(result.skipped.reason).toMatch(reason);
  });

  it("skips a pool of more than 64 maps", () => {
    const labels = Array.from(
      { length: 65 },
      (_, i) => `${["NM", "HD", "HR", "DT", "FM"][i % 5]}${Math.floor(i / 5) + 1}`,
    );
    const result = normalizePool(source(9, "Huge Cup", labels));
    expect(!result.ok && result.skipped.reason).toMatch(/^slots: Too big/);
  });
});

describe("normalizeNotes", () => {
  it("normalizes line breaks, drops control characters but tabs and line breaks, and trims", () => {
    expect(normalizeNotes("  NM1 is\r\nmiss count\u0007\tonly.\r ")).toBe(
      "NM1 is\nmiss count\tonly.",
    );
  });
});

describe("normalizePools", () => {
  it("orders pools by id and keeps the first of an id listed twice", () => {
    const { pools, skipped } = normalizePools([
      source(20, "B Cup Finals", ["NM1"]),
      source(3, "A Cup Finals", ["NM1"]),
      source(20, "B Cup Finals again", ["HD1"]),
      source(4, "Bad Cup", ["NM1", "NM1"]),
    ]);
    expect(pools.map((pool) => pool.source.id)).toEqual(["3", "20"]);
    expect(pools[1]?.name).toBe("B Cup Finals");
    expect(skipped).toEqual([
      expect.objectContaining({ id: "4", reason: "Slot NM1: NM1 appears more than once." }),
      expect.objectContaining({
        id: "20",
        name: "B Cup Finals again",
        reason: "The source lists this pool id twice; the first one was used.",
      }),
    ]);
  });

  it("orders ids that aren't numbers as text, after numbers", () => {
    const named = (id: string): SourcePool => ({
      source: { kind: "otdb", id, url: `https://example.com/${id}` },
      name: `Cup ${id}`,
      notes: "",
      slots: labelled("NM1"),
    });
    const { pools } = normalizePools([named("b"), named("7"), named("a")]);
    expect(pools.map((pool) => pool.source.id)).toEqual(["7", "a", "b"]);
  });

  it("keeps a host or community pool's credit and normalizes it like any other", () => {
    const result = normalizePool({
      source: { kind: "host", id: "hz9y8x7w", credit: { name: "Spring Cup hosts" } },
      name: "Spring Cup 2026 Finals",
      notes: "",
      slots: labelled("NM1", "HD1"),
    });
    expect(result.ok && result.pool.source).toEqual({
      kind: "host",
      id: "hz9y8x7w",
      credit: { name: "Spring Cup hosts" },
    });
  });
});

describe("bySourceId", () => {
  it("puts otdb's numeric ids before generated ones, which can't be all digits", () => {
    const ids = ["hz9y8x7w", "657", "c0000000", "58", "a1b2c3d4"].map((id) => ({ id }));
    expect([...ids].sort(bySourceId).map(({ id }) => id)).toEqual([
      "58",
      "657",
      "a1b2c3d4",
      "c0000000",
      "hz9y8x7w",
    ]);
  });
});
