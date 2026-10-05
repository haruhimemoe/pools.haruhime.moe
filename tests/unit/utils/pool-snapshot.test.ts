/**
 * @file tests/unit/utils/pool-snapshot.test.ts
 * @desc snapshotOf and fromSnapshot round trip a built pool's history-worthy content, the default
 *       bucket list is left out and a custom one kept, and POOL_CODEC diffs and merges slots by
 *       beatmap id rather than position.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Oct 5, 2026
 * @modified Mon Oct 5, 2026
 */

import { DEFAULT_BUCKETS } from "@haruhimemoe/pool";
import { canonicalJson } from "@haruhimemoe/vcs/hash";
import { diffValue, mergeValue } from "@haruhimemoe/vcs/json";
import { describe, expect, it } from "vitest";
import type { BuiltContent } from "@/utils/built-content";
import { fromSnapshot, POOL_CODEC, snapshotOf } from "@/utils/pool-snapshot";

const basePool = (overrides: Partial<BuiltContent> = {}): BuiltContent => ({
  name: "Spring Cup Finals",
  tournament: "Spring Cup",
  round: "Finals",
  year: 2026,
  notes: "",
  slots: [],
  targets: {},
  slotNotes: {},
  ...overrides,
});

describe("snapshotOf", () => {
  it("lists all six default buckets", () => {
    const snapshot = snapshotOf(basePool());
    expect(snapshot.buckets.map((bucket) => bucket.code)).toEqual(
      DEFAULT_BUCKETS.map((bucket) => bucket.code),
    );
  });

  it("passes canonicalJson without throwing", () => {
    const snapshot = snapshotOf(
      basePool({ slots: [{ mod: "NM", index: 1, beatmapId: 1 }], notes: "Tag team." }),
    );
    expect(() => canonicalJson(snapshot)).not.toThrow();
  });
});

describe("round trip", () => {
  it("drops buckets for the default list and keeps a custom one", () => {
    const defaultPool = basePool();
    expect(fromSnapshot(snapshotOf(defaultPool)).buckets).toBeUndefined();

    const custom = basePool({
      buckets: [...DEFAULT_BUCKETS, { code: "EXTRA", color: 0 }],
    });
    expect(fromSnapshot(snapshotOf(custom)).buckets).toMatchObject([
      ...DEFAULT_BUCKETS.map((bucket) => ({ code: bucket.code })),
      { code: "EXTRA" },
    ]);
  });

  it("keeps targets and slot notes", () => {
    const pool = basePool({
      targets: { NM: { count: 4 } },
      slotNotes: { "1001": "no DT" },
    });
    expect(fromSnapshot(snapshotOf(pool))).toMatchObject({
      targets: { NM: { count: 4 } },
      slotNotes: { "1001": "no DT" },
    });
  });
});

describe("POOL_CODEC", () => {
  it("reports two slots swapping places keyed by beatmap id, never as a whole-list set", () => {
    const before = snapshotOf(
      basePool({
        slots: [
          { mod: "NM", index: 1, beatmapId: 1 },
          { mod: "NM", index: 2, beatmapId: 2 },
        ],
      }),
    );
    const after = snapshotOf(
      basePool({
        slots: [
          { mod: "NM", index: 1, beatmapId: 2 },
          { mod: "NM", index: 2, beatmapId: 1 },
        ],
      }),
    );
    const changes = diffValue(before, after, POOL_CODEC);
    // No change is a bare `set` of the whole "slots" list: every change is scoped to a keyed
    // item (a `move`, naming the beatmap id it reorders, or a `set` on that item's own field).
    expect(changes.every((change) => change.path !== "slots" || change.op !== "set")).toBe(true);
    expect(changes.some((change) => change.op === "move" && change.key === "1")).toBe(true);
  });

  it("merges two editors adding different maps to different buckets cleanly", () => {
    const base = snapshotOf(basePool());
    const ours = snapshotOf(basePool({ slots: [{ mod: "NM", index: 1, beatmapId: 1 }] }));
    const theirs = snapshotOf(basePool({ slots: [{ mod: "HD", index: 1, beatmapId: 2 }] }));
    const merge = mergeValue(base, ours, theirs, POOL_CODEC);
    expect(merge.clean).toBe(true);
    expect(merge.value.slots.map((slot) => slot.beatmapId).sort()).toEqual([1, 2]);
  });
});
