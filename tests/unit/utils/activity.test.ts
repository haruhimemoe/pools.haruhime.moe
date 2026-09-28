/**
 * @file tests/unit/utils/activity.test.ts
 * @desc What the activity log says about a change: an ops call's kind (its first op's) and a
 *       summary of each op, joined and cut to 300 characters; a visibility, editor or owner
 *       change.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { describe, expect, it } from "vitest";
import type { PoolOp } from "@/schemas/built-pool-ops";
import {
  activityWhen,
  editorActivity,
  opsActivity,
  ownerActivity,
  visibilityActivity,
  withoutSubject,
} from "@/utils/activity";
import type { BuiltContent } from "@/utils/built-ops";

const POOL: BuiltContent = {
  name: "Cup",
  tournament: "",
  round: "",
  year: null,
  notes: "",
  slots: [
    { mod: "NM", index: 1, beatmapId: 10 },
    { mod: "NM", index: 2, beatmapId: 20 },
  ],
};

const said = (ops: PoolOp[]) => opsActivity(POOL, ops);

describe("opsActivity", () => {
  it.each<[PoolOp, string, string]>([
    [{ type: "setDetails", name: "X", year: 2026 }, "details", "Changed the name and year"],
    [{ type: "addMap", beatmapId: 30, bucket: "HD" }, "add", "Added beatmap 30 to HD1"],
    [
      { type: "removeMap", slot: { bucket: "NM", index: 2 } },
      "remove",
      "Removed beatmap 20 from NM2",
    ],
    [
      { type: "moveMap", slot: { bucket: "NM", index: 1 }, bucket: "DT" },
      "move",
      "Moved beatmap 10 from NM1 to DT1",
    ],
    [{ type: "addBucket", code: "EZ" }, "mods", "Added the slot EZ"],
    [{ type: "removeBucket", code: "TB" }, "mods", "Removed the slot TB"],
    [{ type: "replaceMaps", text: "NM1 5\nNM2 6" }, "add", "Pasted maps: the pool has 2 now"],
    [{ type: "setTarget", bucket: "NM", count: 5 }, "target", "Set NM's target: 5 maps"],
    [{ type: "setTarget", bucket: "NM", count: 0 }, "target", "Cleared NM's target"],
    [{ type: "setNote", beatmapId: 10, note: "aim" }, "note", "Changed the note on NM1"],
    [{ type: "setNote", beatmapId: 10, note: "" }, "note", "Cleared the note on NM1"],
  ])("says %j", (op, kind, summary) => {
    expect(said([op])).toEqual({ kind, summary });
  });

  it("joins a call's ops under the first one's kind, cut to 300 characters", () => {
    const two = said([
      { type: "addMap", beatmapId: 30, bucket: "NM" },
      { type: "setNote", beatmapId: 30, note: "fast" },
    ]);
    expect(two).toEqual({
      kind: "add",
      summary: "Added beatmap 30 to NM3; changed the note on NM3",
    });
    const many = said(
      Array.from(
        { length: 20 },
        (_, i) => ({ type: "addMap", beatmapId: 100 + i, bucket: "NM" }) as PoolOp,
      ),
    );
    expect(many.summary.length).toBeLessThanOrEqual(300);
    expect(many.summary.endsWith("…")).toBe(true);
  });
});

describe("other changes", () => {
  it("says what changed", () => {
    expect(visibilityActivity("public")).toEqual({
      kind: "visibility",
      summary: "Made the pool public",
    });
    const peppy = { osuId: 2, username: "peppy" };
    expect(editorActivity("added", peppy)).toEqual({
      kind: "editors",
      summary: "Added peppy as an editor",
      subject: peppy,
    });
    expect(editorActivity("removed", peppy)).toEqual({
      kind: "editors",
      summary: "Removed peppy as an editor",
      subject: peppy,
    });
    expect(editorActivity("left", peppy)).toEqual({
      kind: "editors",
      summary: "Stopped editing the pool",
    });
    expect(ownerActivity(peppy)).toEqual({
      kind: "owner",
      summary: "Handed the pool to peppy",
      subject: peppy,
    });
  });

  it("rewords an entry about a deleted account, whatever its name", () => {
    for (const username of ["editor", "Added", "pool", "as an"]) {
      const who = { osuId: 3, username };
      expect(withoutSubject(editorActivity("added", who))).toBe("Added deleted user as an editor");
      expect(withoutSubject(editorActivity("removed", who))).toBe(
        "Removed deleted user as an editor",
      );
      expect(withoutSubject(ownerActivity(who))).toBe("Handed the pool to deleted user");
    }
    expect(withoutSubject({ kind: "note", summary: "Changed the note on NM1" })).toBe(
      "Changed the note on NM1",
    );
  });
});

describe("activityWhen", () => {
  const now = new Date("2026-09-28T12:00:00Z");
  it("says how long ago, then the date", () => {
    expect(activityWhen("2026-09-28T11:59:40Z", now)).toBe("just now");
    expect(activityWhen("2026-09-28T11:55:00Z", now)).toBe("5 min ago");
    expect(activityWhen("2026-09-28T09:00:00Z", now)).toBe("3 h ago");
    expect(activityWhen("2026-09-20T09:00:00Z", now)).toBe("Sep 20, 2026");
  });
});
