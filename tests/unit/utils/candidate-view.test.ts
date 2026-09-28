/**
 * @file tests/unit/utils/candidate-view.test.ts
 * @desc How candidates are shown and reused: only members' votes count ("2 of 3 editors"), the
 *       slot-shaped entries for details and values, slots with candidates and no pick, the
 *       slots "Add as candidate" offers, the drops between picks and candidates, the "Your
 *       candidates" list (entries, filters, pages), and exports that hold picks alone.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { describe, expect, it } from "vitest";
import { candidateDropOps, withPickSet } from "@/utils/candidate-drag";
import {
  candidateSlotOptions,
  candidateSlots,
  countedVotes,
  emptyRows,
  membersOf,
  votesText,
} from "@/utils/candidate-view";
import { idLines, mpLines } from "@/utils/pool-export";
import { entriesOf, filterEntries, pageOf } from "@/utils/your-candidates";
import { candidate, WITH_CANDIDATES } from "../../helpers/candidates";
import { builtMap, clientPool } from "../../helpers/pool-editor";

const CANDIDATES = WITH_CANDIDATES.candidates ?? {};
const MAPS = { 10: builtMap(10), 11: builtMap(11, { title: "Freedom Dive" }) };

describe("votes and members", () => {
  it("counts the owner and current editors only", () => {
    const members = membersOf({ owner: { osuId: 1 }, editors: [{ osuId: 2 }, { osuId: 3 }] });
    expect(members).toEqual([1, 2, 3]);
    expect(votesText(candidate(5, { votes: [1, 9] }), members)).toBe("1 of 3 editors");
    expect(votesText(candidate(5), [1])).toBe("0 of 1 editor");
    expect(countedVotes({ "NM:1": [candidate(5, { votes: [1, 9] })] }, members)).toEqual({
      "NM:1": [candidate(5, { votes: [1] })],
    });
    expect(membersOf({ owner: null, editors: [] })).toEqual([]);
  });
});

describe("slots", () => {
  it("gives candidates slot shapes, slots without picks, and the slots to add to", () => {
    expect(candidateSlots(CANDIDATES)).toEqual([
      { mod: "NM", index: 1, beatmapId: 11 },
      { mod: "NM", index: 1, beatmapId: 12 },
      { mod: "NM", index: 4, beatmapId: 41 },
    ]);
    expect(candidateSlots(undefined)).toEqual([]);
    expect(emptyRows(CANDIDATES, WITH_CANDIDATES.slots, "NM")).toEqual([4]);
    const options = candidateSlotOptions({
      buckets: [{ code: "NM" }, { code: "HD" }],
      slots: WITH_CANDIDATES.slots,
      candidates: CANDIDATES,
    });
    expect(options.map((option) => option.label)).toEqual([
      "NM1",
      "NM2",
      "NM4 (no pick)",
      "New NM5",
      "HD1",
      "New HD2",
    ]);
    expect(options[2]).toMatchObject({ value: "NM:4", bucket: "NM", index: 4 });
  });
});

describe("candidateDropOps", () => {
  const pick = { mod: "NM", index: 1, beatmapId: 10 };
  const cand = { mod: "NM", index: 1, beatmapId: 11, candidate: true as const };
  const slot = { bucket: "NM", index: 1 };
  it("demotes a pick onto a list, moving it when it's another slot's", () => {
    expect(candidateDropOps(pick, { bucket: "NM", index: 1, zone: "candidates" }, MAPS)).toEqual([
      { type: "demotePick", slot, beatmapsetId: 100 },
    ]);
    expect(candidateDropOps(pick, { bucket: "NM", index: 3, zone: "candidates" }, {})).toEqual([
      { type: "demotePick", slot, beatmapsetId: null },
      { type: "moveCandidate", slot, beatmapId: 10, to: 3 },
    ]);
    expect(candidateDropOps(pick, { bucket: "NM", index: 2 }, MAPS)).toBeNull();
  });

  it("promotes or moves a candidate within its bucket, and nothing across buckets", () => {
    expect(candidateDropOps(cand, { bucket: "NM", index: 1 }, MAPS)).toEqual([
      { type: "promoteCandidate", slot, beatmapId: 11 },
    ]);
    expect(candidateDropOps(cand, { bucket: "NM", index: 2 }, MAPS)).toEqual([
      { type: "moveCandidate", slot, beatmapId: 11, to: 2 },
      { type: "promoteCandidate", slot: { bucket: "NM", index: 2 }, beatmapId: 11 },
    ]);
    expect(candidateDropOps(cand, { bucket: "NM", index: 2, zone: "candidates" }, MAPS)).toEqual([
      { type: "moveCandidate", slot, beatmapId: 11, to: 2 },
    ]);
    expect(candidateDropOps(cand, { bucket: "NM", index: 1, zone: "candidates" }, MAPS)).toBeNull();
    expect(candidateDropOps(cand, { bucket: "HD", index: 1 }, MAPS)).toBeNull();
    expect(candidateDropOps(cand, { bucket: "NM", index: null }, MAPS)).toBeNull();
  });

  it("gives each promote the replaced pick's set", () => {
    const ops = candidateDropOps(cand, { bucket: "NM", index: 1 }, MAPS) ?? [];
    expect(withPickSet(ops, () => 10, MAPS)).toEqual([
      { type: "promoteCandidate", slot, beatmapId: 11, pickSetId: 100 },
    ]);
    expect(withPickSet(ops, () => null, MAPS)).toEqual(ops);
  });
});

describe("your candidates", () => {
  const pools = [
    { ...WITH_CANDIDATES, _id: "b-a0000001", updatedAt: new Date("2026-09-28T12:00:00Z") },
  ];
  it("lists candidates newest first, picks when asked, and filters and pages them", () => {
    const entries = entriesOf(pools, false);
    expect(entries.map((e) => [e.bucket, e.index, e.beatmapId])).toEqual([
      ["NM", 1, 11],
      ["NM", 1, 12],
      ["NM", 4, 41],
    ]);
    const all = entriesOf(pools, true);
    expect(all[0]).toMatchObject({ kind: "pick", beatmapId: 10, note: "the opener" });
    expect(all.filter((e) => e.kind === "pick")).toHaveLength(3);
    expect(
      filterEntries(entries, { bucket: null, q: "freedom" }, MAPS).map((e) => e.beatmapId),
    ).toEqual([11]);
    expect(
      filterEntries(entries, { bucket: null, q: "SAFER" }, MAPS).map((e) => e.beatmapId),
    ).toEqual([11]);
    expect(filterEntries(entries, { bucket: "HD", q: "" }, MAPS)).toEqual([]);
    expect(pageOf(entries, 1)).toMatchObject({ total: 3, pages: 1 });
    expect(pageOf([], 1)).toMatchObject({ entries: [], total: 0, pages: 1 });
  });
});

describe("picks only", () => {
  it("leaves candidates out of every export", () => {
    const pool = clientPool({ candidates: { "NM:1": [candidate(77)] } });
    expect(idLines(pool)).not.toMatch(/77/);
    expect(mpLines(pool)).not.toMatch(/77/);
  });
});
