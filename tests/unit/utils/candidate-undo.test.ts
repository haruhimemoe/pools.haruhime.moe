/**
 * @file tests/unit/utils/candidate-undo.test.ts
 * @desc Undo for the candidate ops: every op's inverse puts the pool back (candidates compared by
 *       map, set, note and place), a vote goes back to the voter's own earlier state, and the map
 *       ops that keep or fill a slot with candidates undo exactly too. The activity log names
 *       each candidate op and leaves votes out.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { describe, expect, it } from "vitest";
import type { PoolOp } from "@/schemas/built-pool-ops";
import { opsActivity } from "@/utils/activity";
import type { BuiltContent } from "@/utils/built-content";
import { inverseOf, sameContent } from "@/utils/undo";
import { applied, ME, WITH_CANDIDATES } from "../../helpers/candidates";

const NM1 = { bucket: "NM", index: 1 };
const NM4 = { bucket: "NM", index: 4 };

const undone = (ops: PoolOp[], pool: BuiltContent = WITH_CANDIDATES) => {
  const inverse = inverseOf(pool, ops, ME);
  if (!inverse) throw new Error("no inverse");
  return { inverse, back: applied(applied(pool, ops), inverse) };
};

describe("candidate undo", () => {
  it.each<[string, PoolOp]>([
    ["add", { type: "addCandidate", slot: NM1, beatmapId: 13, beatmapsetId: 1, at: 1 }],
    ["remove", { type: "removeCandidate", slot: NM1, beatmapId: 11 }],
    ["remove the last", { type: "removeCandidate", slot: NM4, beatmapId: 41 }],
    ["promote over a pick", { type: "promoteCandidate", slot: NM1, beatmapId: 12, pickSetId: 100 }],
    ["promote into an empty slot", { type: "promoteCandidate", slot: NM4, beatmapId: 41 }],
    ["demote", { type: "demotePick", slot: NM1, at: 1 }],
    ["note", { type: "setCandidateNote", slot: NM1, beatmapId: 11, note: "no" }],
    ["vote", { type: "voteCandidate", slot: NM1, beatmapId: 11, on: true }],
    ["move", { type: "moveCandidate", slot: NM1, beatmapId: 11, to: 2 }],
    ["remove a pick with candidates", { type: "removeMap", slot: NM1 }],
    ["move a row down", { type: "moveMap", slot: NM1, bucket: "NM", index: 2 }],
    ["move a pick to another bucket", { type: "moveMap", slot: NM1, bucket: "HD" }],
    ["add into an empty slot", { type: "addMap", beatmapId: 99, bucket: "NM", index: 4 }],
  ])("puts the pool back after %s", (_, op) => {
    const { back } = undone([op]);
    expect(sameContent(back, applied(WITH_CANDIDATES, []))).toBe(true);
  });

  it("gives a vote back its own earlier state", () => {
    const { inverse, back } = undone([
      { type: "voteCandidate", slot: NM1, beatmapId: 12, on: true },
    ]);
    expect(inverse).toEqual([{ type: "voteCandidate", slot: NM1, beatmapId: 12, on: true }]);
    expect(back.candidates?.["NM:1"]?.[1]?.votes).toEqual([8, 7]);
  });

  it("brings a removed candidate back with its note, as yours with no votes", () => {
    const { back } = undone([{ type: "removeCandidate", slot: NM1, beatmapId: 12 }]);
    expect(back.candidates?.["NM:1"]?.[1]).toMatchObject({ beatmapId: 12, addedBy: 7, votes: [] });
  });
});

describe("candidate activity", () => {
  it("names each candidate op and leaves votes out", () => {
    const vote: PoolOp = { type: "voteCandidate", slot: NM1, beatmapId: 11, on: true };
    expect(opsActivity(WITH_CANDIDATES, [vote])).toBeNull();
    expect(
      opsActivity(WITH_CANDIDATES, [
        vote,
        { type: "promoteCandidate", slot: NM1, beatmapId: 11 },
        { type: "addCandidate", slot: NM4, beatmapId: 5, beatmapsetId: 5 },
      ]),
    ).toEqual({
      kind: "candidate-promote",
      summary:
        "Picked candidate 11 for NM1 in place of beatmap 10; added beatmap 5 as a candidate for NM4",
    });
    expect(opsActivity(WITH_CANDIDATES, [{ type: "demotePick", slot: NM1 }])?.kind).toBe(
      "candidate-demote",
    );
    expect(
      opsActivity(WITH_CANDIDATES, [{ type: "moveCandidate", slot: NM1, beatmapId: 11, to: 3 }]),
    ).toEqual({ kind: "candidate-move", summary: "Moved candidate 11 from NM1 to NM3" });
  });
});
