/**
 * @file tests/unit/utils/sortable-ids.test.ts
 * @desc The editor's sortable ids: building them, reading a dragged pick from the current pool
 *       (by beatmap id) or a candidate from its id, turning a ui move into a DropTarget (a
 *       bucket's space, a pick row, an empty slot, a candidate list, a code holding ":"), and the
 *       two candidate refusals.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Oct 4, 2026
 * @modified Mon Oct 5, 2026
 */

import { describe, expect, it } from "vitest";
import { CANDIDATE_DRAG_TEXT } from "@/constants/candidates";
import {
  bucketListId,
  candidateId,
  candidateListId,
  candidateRefusal,
  dragItemOf,
  dropTargetOf,
  emptySlotId,
  pickId,
} from "@/utils/sortable-ids";

const SLOTS = [
  { mod: "NM", index: 1, beatmapId: 10 },
  { mod: "NM", index: 2, beatmapId: 30 },
  { mod: null, index: 1, beatmapId: 99 },
];
const to = (container: string, index = 0) => ({ container, index });

describe("sortable ids", () => {
  it("builds every id", () => {
    expect(bucketListId("NM")).toBe("b:NM");
    expect(bucketListId(null)).toBe("b:");
    expect(candidateListId({ bucket: "NM", index: 2 })).toBe("c:NM:2");
    expect(pickId(30)).toBe("pick:30");
    expect(candidateId({ bucket: "NM", index: 2 }, 456)).toBe("cand:NM:2:456");
    expect(emptySlotId({ bucket: "NM", index: 4 })).toBe("empty:NM:4");
  });

  it("reads the dragged pick from the current pool, and a candidate from its id", () => {
    expect(dragItemOf("pick:30", SLOTS)).toEqual({ mod: "NM", index: 2, beatmapId: 30 });
    expect(dragItemOf("pick:31", SLOTS)).toBeNull();
    expect(dragItemOf("cand:NM:2:456", SLOTS)).toEqual({
      mod: "NM",
      index: 2,
      beatmapId: 456,
      candidate: true,
    });
    expect(dragItemOf("cand:A:B:2:456", SLOTS)).toEqual({
      mod: "A:B",
      index: 2,
      beatmapId: 456,
      candidate: true,
    });
    expect(dragItemOf("cand:NM:x:456", SLOTS)).toBeNull();
    expect(dragItemOf("other", SLOTS)).toBeNull();
  });

  it("turns a move into the DropTarget dropOp and candidateDropOps take", () => {
    expect(dropTargetOf({ to: to("b:HD", 0), onto: null }, SLOTS)).toEqual({
      bucket: "HD",
      index: null,
    });
    expect(dropTargetOf({ to: to("b:", 0), onto: null }, SLOTS)).toEqual({
      bucket: null,
      index: null,
    });
    expect(dropTargetOf({ to: to("b:NM", 0), onto: "pick:10" }, SLOTS)).toEqual({
      bucket: "NM",
      index: 1,
    });
    expect(dropTargetOf({ to: to("b:NM", 2), onto: "empty:NM:4" }, SLOTS)).toEqual({
      bucket: "NM",
      index: 4,
    });
    expect(dropTargetOf({ to: to("c:NM:5", 0), onto: null }, SLOTS)).toEqual({
      bucket: "NM",
      index: 5,
      zone: "candidates",
    });
    expect(dropTargetOf({ to: to("c:NM:5", 0), onto: "cand:NM:5:7" }, SLOTS)).toEqual({
      bucket: "NM",
      index: 5,
      zone: "candidates",
    });
    expect(dropTargetOf({ to: to("b:NM", 0), onto: "pick:31" }, SLOTS)).toBeNull();
    expect(dropTargetOf({ to: to("x:NM", 0), onto: null }, SLOTS)).toBeNull();
  });

  it("refuses a candidate outside its bucket or on a bucket's own space", () => {
    const candidate = { mod: "NM", index: 2, beatmapId: 456, candidate: true as const };
    expect(candidateRefusal(candidate, { bucket: "HD", index: 1 })).toBe(
      CANDIDATE_DRAG_TEXT.otherBucket,
    );
    expect(candidateRefusal(candidate, { bucket: "NM", index: null })).toBe(
      CANDIDATE_DRAG_TEXT.noSlot,
    );
    expect(candidateRefusal(candidate, { bucket: "NM", index: 1 })).toBeNull();
    expect(
      candidateRefusal(SLOTS[0] as (typeof SLOTS)[number], { bucket: "HD", index: null }),
    ).toBeNull();
  });
});
