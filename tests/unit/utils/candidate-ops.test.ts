/**
 * @file tests/unit/utils/candidate-ops.test.ts
 * @desc The candidate ops: add (the 10 cap, the pool's 100 cap, no map twice in a slot, never the
 *       slot's own pick, the same map in two slots), remove, promote (with and without a pick,
 *       notes moving both ways), demote, note, votes (one per person, toggled) and move within a
 *       bucket; and how picks treat candidates: a removed pick leaves its slot's candidates, an
 *       added map fills a slot that has candidates and no pick, a move within a bucket takes the
 *       candidates along, a move to another bucket doesn't, and a map that becomes a slot's pick
 *       stops being its candidate.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { describe, expect, it } from "vitest";
import type { PoolOp } from "@/schemas/built-pool-ops";
import { applyOps } from "@/utils/built-ops";
import { applied, candidate, ME, WITH_CANDIDATES } from "../../helpers/candidates";

const NM1 = { bucket: "NM", index: 1 };
const NM4 = { bucket: "NM", index: 4 };
const refusal = (ops: PoolOp[], pool = WITH_CANDIDATES) => {
  const result = applyOps(pool, ops, ME);
  return result.ok ? null : result.code;
};
const ids = (pool: typeof WITH_CANDIDATES, key: string) =>
  (pool.candidates?.[key] ?? []).map((entry) => entry.beatmapId);

describe("addCandidate", () => {
  it("adds at the end with who and when, the note, and no votes", () => {
    const op: PoolOp = {
      type: "addCandidate",
      slot: NM1,
      beatmapId: 13,
      beatmapsetId: 130,
      note: "hmm",
    };
    const pool = applied(WITH_CANDIDATES, [op]);
    expect(pool.candidates?.["NM:1"]?.[2]).toEqual({
      beatmapId: 13,
      beatmapsetId: 130,
      addedBy: 7,
      addedAt: ME.now,
      note: "hmm",
      votes: [],
    });
  });

  it("adds at a place, and to a slot with no pick yet", () => {
    const first = applied(WITH_CANDIDATES, [
      { type: "addCandidate", slot: NM1, beatmapId: 13, beatmapsetId: null, at: 0 },
      { type: "addCandidate", slot: { bucket: "HR", index: 1 }, beatmapId: 50, beatmapsetId: 5 },
    ]);
    expect(ids(first, "NM:1")).toEqual([13, 11, 12]);
    expect(ids(first, "HR:1")).toEqual([50]);
    expect(first.slots.some((slot) => slot.mod === "HR")).toBe(false);
  });

  it("refuses an 11th candidate, a map twice, the slot's pick and an unknown bucket", () => {
    const ten = {
      ...WITH_CANDIDATES,
      candidates: { "NM:1": [1, 2, 3, 4, 5, 6, 7, 8, 9, 11].map((id) => candidate(id)) },
    };
    const add = (beatmapId: number, slot = NM1): PoolOp => ({
      type: "addCandidate",
      slot,
      beatmapId,
      beatmapsetId: 1,
    });
    expect(refusal([add(99)], ten)).toBe("candidate_full");
    expect(refusal([add(11)])).toBe("candidate_duplicate");
    expect(refusal([add(10)])).toBe("candidate_is_pick");
    expect(refusal([add(99, { bucket: "EZ", index: 1 })])).toBe("unknown_bucket");
  });

  it("lets a map be a candidate in two slots, and a pick elsewhere", () => {
    const pool = applied(WITH_CANDIDATES, [
      { type: "addCandidate", slot: { bucket: "NM", index: 2 }, beatmapId: 11, beatmapsetId: 110 },
      { type: "addCandidate", slot: { bucket: "HD", index: 1 }, beatmapId: 10, beatmapsetId: 100 },
    ]);
    expect(ids(pool, "NM:2")).toEqual([11]);
    expect(ids(pool, "HD:1")).toEqual([10]);
  });

  it("refuses the 101st candidate in a pool", () => {
    const candidates = Object.fromEntries(
      Array.from({ length: 10 }, (_, slot) => [
        `NM:${slot + 10}`,
        Array.from({ length: 10 }, (_, i) => candidate(1000 + slot * 10 + i)),
      ]),
    );
    const full = { ...WITH_CANDIDATES, candidates };
    expect(
      refusal([{ type: "addCandidate", slot: NM1, beatmapId: 99, beatmapsetId: 1 }], full),
    ).toBe("candidate_pool_full");
  });
});

describe("remove, note and vote", () => {
  it("removes one, and drops a list that empties", () => {
    const pool = applied(WITH_CANDIDATES, [
      { type: "removeCandidate", slot: NM1, beatmapId: 11 },
      { type: "removeCandidate", slot: NM4, beatmapId: 41 },
    ]);
    expect(ids(pool, "NM:1")).toEqual([12]);
    expect(pool.candidates).not.toHaveProperty("NM:4");
    expect(refusal([{ type: "removeCandidate", slot: NM1, beatmapId: 99 }])).toBe(
      "unknown_candidate",
    );
  });

  it("sets and clears a note", () => {
    const set = applied(WITH_CANDIDATES, [
      { type: "setCandidateNote", slot: NM1, beatmapId: 12, note: "fast" },
    ]);
    expect(set.candidates?.["NM:1"]?.[1]?.note).toBe("fast");
    const cleared = applied(set, [
      { type: "setCandidateNote", slot: NM1, beatmapId: 12, note: "" },
    ]);
    expect(cleared.candidates?.["NM:1"]?.[1]?.note).toBe("");
  });

  it("keeps one vote per person, and takes it back", () => {
    const vote = (on: boolean): PoolOp[] => [
      { type: "voteCandidate", slot: NM1, beatmapId: 12, on },
    ];
    const twice = applied(applied(WITH_CANDIDATES, vote(true)), vote(true));
    expect(twice.candidates?.["NM:1"]?.[1]?.votes).toEqual([8, 7]);
    const off = applied(twice, vote(false));
    expect(off.candidates?.["NM:1"]?.[1]?.votes).toEqual([8]);
    const other = applied(off, vote(true), { ...ME, osuId: 9 });
    expect(other.candidates?.["NM:1"]?.[1]?.votes).toEqual([8, 9]);
  });
});

describe("promote and demote", () => {
  it("swaps the pick for a candidate, notes following their maps", () => {
    const pool = applied(WITH_CANDIDATES, [
      { type: "promoteCandidate", slot: NM1, beatmapId: 11, pickSetId: 100 },
    ]);
    expect(pool.slots.find((slot) => slot.mod === "NM" && slot.index === 1)?.beatmapId).toBe(11);
    expect(pool.slotNotes).toEqual({ 11: "safer" });
    expect(pool.candidates?.["NM:1"]?.[0]).toMatchObject({
      beatmapId: 10,
      beatmapsetId: 100,
      note: "the opener",
      votes: [],
    });
  });

  it("fills a slot with no pick, and refuses a map already picked elsewhere", () => {
    const pool = applied(WITH_CANDIDATES, [{ type: "promoteCandidate", slot: NM4, beatmapId: 41 }]);
    expect(pool.slots).toContainEqual({ mod: "NM", index: 4, beatmapId: 41 });
    expect(pool.candidates).not.toHaveProperty("NM:4");
    const picked = applied(WITH_CANDIDATES, [
      { type: "addCandidate", slot: NM4, beatmapId: 30, beatmapsetId: 3 },
    ]);
    expect(refusal([{ type: "promoteCandidate", slot: NM4, beatmapId: 30 }], picked)).toBe(
      "duplicate",
    );
  });

  it("demotes the pick into the list and keeps the slot", () => {
    const pool = applied(WITH_CANDIDATES, [{ type: "demotePick", slot: NM1, beatmapsetId: 100 }]);
    expect(pool.slots.some((slot) => slot.beatmapId === 10)).toBe(false);
    expect(pool.slots).toContainEqual({ mod: "NM", index: 2, beatmapId: 20 });
    expect(ids(pool, "NM:1")).toEqual([11, 12, 10]);
    expect(pool.candidates?.["NM:1"]?.[2]?.note).toBe("the opener");
    expect(pool.slotNotes).toEqual({});
    expect(refusal([{ type: "demotePick", slot: NM4 }])).toBe("no_pick");
  });
});

describe("moveCandidate", () => {
  it("moves within the bucket, keeping note, adder and votes", () => {
    const pool = applied(WITH_CANDIDATES, [
      { type: "moveCandidate", slot: NM1, beatmapId: 12, to: 4, at: 0 },
    ]);
    expect(ids(pool, "NM:1")).toEqual([11]);
    expect(ids(pool, "NM:4")).toEqual([12, 41]);
    expect(pool.candidates?.["NM:4"]?.[0]?.votes).toEqual([7, 8]);
  });

  it("refuses a move onto the target's pick", () => {
    expect(refusal([{ type: "moveCandidate", slot: NM4, beatmapId: 41, to: 2 }])).toBeNull();
    const onPick = applied(WITH_CANDIDATES, [
      { type: "addCandidate", slot: NM4, beatmapId: 20, beatmapsetId: 2 },
    ]);
    expect(refusal([{ type: "moveCandidate", slot: NM4, beatmapId: 20, to: 2 }], onPick)).toBe(
      "candidate_is_pick",
    );
  });
});

describe("picks and their slot's candidates", () => {
  it("keeps the slot when its pick is removed, and closes up one with none", () => {
    const kept = applied(WITH_CANDIDATES, [{ type: "removeMap", slot: NM1 }]);
    expect(kept.slots.filter((slot) => slot.mod === "NM")).toEqual([
      { mod: "NM", index: 2, beatmapId: 20 },
    ]);
    expect(ids(kept, "NM:1")).toEqual([11, 12]);
    const closed = applied(WITH_CANDIDATES, [
      { type: "removeMap", slot: { bucket: "NM", index: 2 } },
    ]);
    expect(ids(closed, "NM:3")).toEqual([41]);
  });

  it("fills a slot with candidates and no pick when a map is added there", () => {
    const three = applied(WITH_CANDIDATES, [
      { type: "moveCandidate", slot: NM4, beatmapId: 41, to: 3 },
    ]);
    const pool = applied(three, [{ type: "addMap", beatmapId: 99, bucket: "NM" }]);
    expect(pool.slots).toContainEqual({ mod: "NM", index: 3, beatmapId: 99 });
    expect(ids(pool, "NM:3")).toEqual([41]);
  });

  it("moves a slot's candidates with its pick within a bucket, not to another", () => {
    const down = applied(WITH_CANDIDATES, [{ type: "moveMap", slot: NM1, bucket: "NM", index: 2 }]);
    expect(down.slots.filter((s) => s.mod === "NM").map((s) => s.beatmapId)).toEqual([20, 10]);
    expect(ids(down, "NM:2")).toEqual([11, 12]);
    const away = applied(WITH_CANDIDATES, [{ type: "moveMap", slot: NM1, bucket: "HD" }]);
    expect(away.slots).toContainEqual({ mod: "HD", index: 2, beatmapId: 10 });
    expect(ids(away, "NM:1")).toEqual([11, 12]);
  });

  it("stops a map being its slot's candidate once it's the pick, and keeps buckets with candidates", () => {
    const three = applied(WITH_CANDIDATES, [
      { type: "moveCandidate", slot: NM4, beatmapId: 41, to: 3 },
    ]);
    const pool = applied(three, [{ type: "addMap", beatmapId: 41, bucket: "NM" }]);
    expect(pool.candidates).not.toHaveProperty("NM:3");
    const custom = {
      ...WITH_CANDIDATES,
      buckets: [...(WITH_CANDIDATES.buckets ?? []), { code: "EZ", color: 3 }],
    };
    const held = applied(custom, [
      { type: "addCandidate", slot: { bucket: "EZ", index: 1 }, beatmapId: 5, beatmapsetId: 5 },
    ]);
    expect(refusal([{ type: "removeBucket", code: "EZ" }], held)).toBe("bucket_not_empty");
  });
});
