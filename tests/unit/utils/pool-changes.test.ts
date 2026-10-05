/**
 * @file tests/unit/utils/pool-changes.test.ts
 * @desc poolChangeLines: a map added or removed, a cross-slot move reported once (even when a
 *       mod/index set and a top-level move both fire), a within-slot reorder, a custom bucket's
 *       mods change, a note added, and a detail renamed.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Oct 5, 2026
 * @modified Mon Oct 5, 2026
 */

import { DEFAULT_BUCKETS } from "@haruhimemoe/pool";
import { diffValue } from "@haruhimemoe/vcs/json";
import { describe, expect, it } from "vitest";
import { poolChangeLines } from "@/utils/pool-changes";
import { POOL_CODEC, type PoolSnapshot } from "@/utils/pool-snapshot";

const snap = (over: Partial<PoolSnapshot> = {}): PoolSnapshot => ({
  name: "Spring Cup Finals",
  tournament: "Spring Cup",
  round: "Finals",
  year: 2026,
  notes: "",
  buckets: [...DEFAULT_BUCKETS],
  slots: [],
  targets: {},
  slotNotes: {},
  ...over,
});

const linesFor = (before: PoolSnapshot, after: PoolSnapshot) =>
  poolChangeLines(diffValue(before, after, POOL_CODEC), before, after);

describe("poolChangeLines", () => {
  it("reports a map added", () => {
    const before = snap();
    const after = snap({ slots: [{ mod: "NM", index: 1, beatmapId: 1001 }] });
    expect(linesFor(before, after)).toEqual([
      { kind: "added", text: "Added 1001 to NM1", beatmapId: 1001 },
    ]);
  });

  it("reports a map removed", () => {
    const before = snap({ slots: [{ mod: "NM", index: 1, beatmapId: 1001 }] });
    const after = snap();
    expect(linesFor(before, after)).toEqual([
      { kind: "removed", text: "Removed 1001 from NM1", beatmapId: 1001 },
    ]);
  });

  it("reports a cross-slot move once, even when mods and index both change", () => {
    const before = snap({ slots: [{ mod: "NM", index: 1, beatmapId: 1001 }] });
    const after = snap({ slots: [{ mod: "HD", index: 2, beatmapId: 1001 }] });
    const lines = linesFor(before, after);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ kind: "moved", text: "Moved 1001 from NM1 to HD2" });
  });

  it("reports a within-slot reorder", () => {
    const before = snap({
      slots: [
        { mod: "NM", index: 1, beatmapId: 1 },
        { mod: "NM", index: 2, beatmapId: 2 },
      ],
    });
    const after = snap({
      slots: [
        { mod: "NM", index: 1, beatmapId: 2 },
        { mod: "NM", index: 2, beatmapId: 1 },
      ],
    });
    const lines = linesFor(before, after);
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.every((line) => line.kind === "moved")).toBe(true);
  });

  it("reports a custom bucket's mods change", () => {
    const buckets = [...DEFAULT_BUCKETS, { code: "EXTRA", color: 0 }];
    const before = snap({ buckets });
    const after = snap({
      buckets: buckets.map((bucket) =>
        bucket.code === "EXTRA" ? { ...bucket, mods: { kind: "free" as const } } : bucket,
      ),
    });
    expect(linesFor(before, after)).toEqual([
      { kind: "changed", text: "Changed the mods on EXTRA" },
    ]);
  });

  it("reports a note added", () => {
    const before = snap({ slots: [{ mod: "NM", index: 1, beatmapId: 1001 }] });
    const after = snap({
      slots: [{ mod: "NM", index: 1, beatmapId: 1001 }],
      slotNotes: { "1001": "no DT" },
    });
    expect(linesFor(before, after)).toEqual([
      { kind: "added", text: "Added a note on 1001", beatmapId: 1001 },
    ]);
  });

  it("reports a note's text changed", () => {
    const before = snap({
      slots: [{ mod: "NM", index: 1, beatmapId: 1001 }],
      slotNotes: { "1001": "no DT" },
    });
    const after = snap({
      slots: [{ mod: "NM", index: 1, beatmapId: 1001 }],
      slotNotes: { "1001": "no HD" },
    });
    expect(linesFor(before, after)).toEqual([
      { kind: "changed", text: "Changed the note on 1001", beatmapId: 1001 },
    ]);
  });

  it("reports a bucket's target changed", () => {
    const before = snap({ targets: { NM: { count: 4 } } });
    const after = snap({ targets: { NM: { count: 6 } } });
    expect(linesFor(before, after)).toEqual([
      { kind: "changed", text: "Changed the target for NM" },
    ]);
  });

  it("reports the pool's notes changed", () => {
    const before = snap({ notes: "Line one" });
    const after = snap({ notes: "Line one\nLine two" });
    expect(linesFor(before, after)).toEqual([{ kind: "changed", text: "Changed the notes" }]);
  });

  it("reports a detail renamed", () => {
    const before = snap();
    const after = snap({ name: "Summer Cup Finals" });
    expect(linesFor(before, after)).toEqual([
      { kind: "changed", text: "Changed the name to Summer Cup Finals" },
    ]);
  });
});
