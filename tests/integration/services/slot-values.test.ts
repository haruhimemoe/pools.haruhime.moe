/**
 * @file tests/integration/services/slot-values.test.ts
 * @desc Values under each pool slot's mods against a stand-in pp/batch (msw) and the mod_values
 *       cache: NM, FM and TB slots keep their no-mod values without asking; HD and modded slots
 *       take stars, AR, OD and CS from the mirror and BPM and length from the math, one call per
 *       combo; a map the mirror lacks keeps its no-mod rating with the rest computed ("math":
 *       no mod data); a failed call still answers, marked incomplete. A past pool's values follow
 *       its source slots, and a built pool's are keyed by map and combo, both from the maps'
 *       stored no-mod values.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

import { HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { resetMirrorCooldown } from "@/lib/map-search";
import {
  builtSlotValues,
  pastSlotValues,
  type SlotValueRequest,
  slotValues,
} from "@/services/slot-values";
import { setupTestDb } from "../../helpers/db";
import { setupMsw } from "../../helpers/msw";
import { type BatchCall, ppBatchAnswering, ppBatchHandler, ppValues } from "../../helpers/pp-batch";

setupTestDb();
const server = setupMsw();
beforeEach(resetMirrorCooldown);

const NO_MOD = { stars: 5.5, ar: 9, od: 8, cs: 4, bpm: 180, length: 120 };
const slot = (beatmapId: number, mods: string): SlotValueRequest => ({
  beatmapId,
  mods,
  noMod: NO_MOD,
});

describe("slotValues", () => {
  it("keeps no-mod values for NM, FM and TB slots without asking", async () => {
    const calls: BatchCall[] = [];
    server.use(ppBatchHandler(() => ppValues(), calls));
    const { values, complete } = await slotValues([slot(1, "NM"), slot(3, "FM"), slot(4, "TB")]);
    expect(calls).toEqual([]);
    expect(complete).toBe(true);
    expect(values).toEqual(Array(3).fill({ ...NO_MOD, mods: "NM", source: "none" }));
  });

  it("takes an HD slot's values from the mirror's HD values", async () => {
    const calls: BatchCall[] = [];
    server.use(ppBatchHandler(() => ppValues({ stars: 5.71 }), calls));
    const { values } = await slotValues([slot(2, "HD")]);
    expect(calls.map((call) => [call.mods, call.ids])).toEqual([["HD", [2]]]);
    expect(values[0]).toMatchObject({ stars: 5.71, bpm: 180, mods: "HD", source: "mirror" });
  });

  it("takes modded values from the mirror, one call per combo", async () => {
    const calls: BatchCall[] = [];
    server.use(
      ppBatchHandler(
        (_id, mods) => ppValues({ stars: mods === "DT" ? 7.25 : 6.1, ar: 10.333, od: 9.778 }),
        calls,
      ),
    );
    const { values } = await slotValues([slot(1, "DT"), slot(2, "DT"), slot(3, "HDHR")]);
    expect(calls.map((call) => [call.mods, call.ids])).toEqual([
      ["DT", [1, 2]],
      ["HDHR", [3]],
    ]);
    expect(values[0]).toEqual({
      stars: 7.25,
      ar: 10.33,
      od: 9.78,
      cs: 4,
      bpm: 270,
      length: 80,
      mods: "DT",
      source: "mirror",
    });
    expect(values[2]).toMatchObject({ stars: 6.1, bpm: 180, length: 120, mods: "HDHR" });
  });

  it("computes what the mirror lacks, keeping the no-mod rating", async () => {
    server.use(ppBatchHandler(() => undefined));
    const { values, complete } = await slotValues([
      slot(1, "HR"),
      { beatmapId: 2, mods: "DT", noMod: { ...NO_MOD, ar: null, bpm: null } },
    ]);
    expect(complete).toBe(true);
    expect(values[0]).toEqual({
      stars: 5.5,
      ar: 10,
      od: 10,
      cs: 5.2,
      bpm: 180,
      length: 120,
      mods: "HR",
      source: "math",
    });
    expect(values[1]).toMatchObject({ ar: null, od: 9.78, bpm: null, length: 80, source: "math" });
  });

  it("answers from the math, marked incomplete, when the mirror fails", async () => {
    server.use(ppBatchAnswering(() => HttpResponse.json({ error: "x" }, { status: 503 })));
    const { values, complete } = await slotValues([slot(1, "EZ")]);
    expect(complete).toBe(false);
    expect(values[0]).toMatchObject({ stars: 5.5, ar: 4.5, od: 4, cs: 2, source: "math" });
  });
});

describe("pastSlotValues and builtSlotValues", () => {
  const MAP = { stars: 5.5, ar: 9, od: 8, cs: 4, bpm: 180, length: 120 };

  it("gives a past pool's source slots their slots' values, in order", async () => {
    server.use(ppBatchHandler((id) => (id === 2 ? ppValues({ stars: 7.25 }) : undefined)));
    const pool = {
      slots: [
        { mod: "NM", index: 1, beatmapId: 1 },
        { mod: "DT", index: 1, beatmapId: 2 },
      ],
      sourceSlots: [
        { label: "NM1", beatmapId: 1, mods: [] },
        { label: "DT1", beatmapId: 2, mods: ["DT"] },
      ],
    };
    const maps = new Map([
      [1, MAP],
      [2, MAP],
    ]);
    const { values, complete } = await pastSlotValues(pool, maps);
    expect(complete).toBe(true);
    expect(values.map((value) => [value.mods, value.source, value.stars])).toEqual([
      ["NM", "none", 5.5],
      ["DT", "mirror", 7.25],
    ]);
  });

  it("keys a built pool's values by map and combo", async () => {
    server.use(ppBatchHandler(() => ppValues({ stars: 6.5 })));
    const pool = {
      buckets: [{ code: "NM" }, { code: "HR" }] as never,
      slots: [
        { mod: "NM", index: 1, beatmapId: 1 },
        { mod: "HR", index: 1, beatmapId: 2 },
      ],
    };
    const { values } = await builtSlotValues(pool, { 1: { ...MAP }, 2: null });
    expect(Object.keys(values).sort()).toEqual(["1:NM", "2:HR"]);
    expect(values["2:HR"]).toMatchObject({ stars: 6.5, bpm: null, source: "mirror" });
    expect(values["1:NM"]).toMatchObject({ stars: 5.5, source: "none" });
  });
});
