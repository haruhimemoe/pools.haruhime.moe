/**
 * @file tests/integration/services/map-fill.test.ts
 * @desc The mirror fill (through the real client against the mirror's recorded rows, and with
 *       injected lookups): every otdb-seeded map is asked for 100 at a time, found maps take the
 *       mirror's values, misses stay for the next run (which asks only them), a retryable
 *       mirror error waits its Retry-After and tries again (at most 3 times), and any other
 *       error stops the fill with a reason instead of throwing.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Mon Sep 28, 2026
 */

import { HinaiError } from "@haruhimemoe/mirror/hinai";
import { hinaiBatchHandler, recordedBeatmaps } from "@haruhimemoe/mirror/testing";
import { setupMsw } from "@haruhimemoe/next-kit/testing";
import type { BeatmapMeta } from "@haruhimemoe/osu/shapes";
import { describe, expect, it, vi } from "vitest";
import { mapsCollection } from "@/models/Map";
import { fillMaps, type MapLookup } from "@/services/map-fill";
import { seededMap } from "@/utils/map-record";
import { setupTestDb } from "../../helpers/db";
import { T0 } from "../../helpers/records";

setupTestDb();
// The real client, answered by the mirror's own recorded rows (hinai/testing).
setupMsw(hinaiBatchHandler);

const SEED = {
  setId: 1,
  artist: "a",
  title: "t",
  setHost: "c",
  version: "d",
  ar: 9,
  od: 8,
  cs: 4,
  hp: 6,
  length: 100,
  bpm: 150,
};

const meta = (id: number): BeatmapMeta => ({
  beatmapId: id,
  beatmapsetId: 1000 + id,
  mode: "osu",
  title: `Title ${id}`,
  artist: "Artist",
  version: "Insane",
  creator: "Host",
  creatorId: 2,
  cs: 4,
  ar: 9,
  od: 8,
  hp: 6,
  bpm: 180,
  lengthSeconds: 120,
  starRating: 5 + id / 1000,
  checksum: null,
});

const seedMapsRange = async (count: number) => {
  const maps = await mapsCollection();
  await maps.insertMany(Array.from({ length: count }, (_, i) => seededMap(i + 1, SEED, T0)));
  return maps;
};

const noWait = async () => {};

describe("fillMaps", () => {
  it("fills maps from the mirror's own answers, through the real client", async () => {
    const maps = await mapsCollection();
    const ids = [...recordedBeatmaps.map((row) => row.id), 5];
    await maps.insertMany(ids.map((id) => seededMap(id, SEED, T0)));
    expect(await fillMaps({ now: () => T0, sleep: noWait })).toEqual({
      asked: 4,
      filled: 3,
      missing: 1,
      error: null,
    });
    const [row] = recordedBeatmaps;
    expect(await maps.findOne({ _id: row?.id })).toMatchObject({
      setId: row?.beatmapset_id,
      version: row?.version,
      stars: row?.difficulty_rating,
      metaSource: "mirror",
    });
    expect(await maps.findOne({ _id: 5 })).toMatchObject({ metaSource: "otdb" });
  });

  it("fills what the mirror has, 100 ids a call, and leaves misses for the next run", async () => {
    const maps = await seedMapsRange(150);
    const lookup = vi.fn<MapLookup>(async (ids) => ({
      found: new Map(ids.filter((id) => id % 50 !== 0).map((id) => [id, meta(id)])),
      missing: ids.filter((id) => id % 50 === 0),
    }));
    expect(await fillMaps({ lookup, now: () => T0, sleep: noWait })).toEqual({
      asked: 150,
      filled: 147,
      missing: 3,
      error: null,
    });
    expect(lookup).toHaveBeenCalledTimes(2);
    expect(lookup.mock.calls[0]?.[0]).toHaveLength(100);
    expect(await maps.findOne({ _id: 1 })).toMatchObject({
      stars: 5.001,
      setHostId: 2,
      metaSource: "mirror",
    });
    expect(await maps.findOne({ _id: 50 })).toMatchObject({ stars: null, metaSource: "otdb" });
    lookup.mockClear();
    await fillMaps({ lookup, now: () => T0, sleep: noWait });
    expect(lookup.mock.calls[0]?.[0]).toEqual([50, 100, 150]);
  });

  it("waits the mirror's Retry-After and tries a batch again", async () => {
    await seedMapsRange(1);
    const sleep = vi.fn(noWait);
    const lookup = vi
      .fn<MapLookup>()
      .mockRejectedValueOnce(
        new HinaiError("rate_limited", "Slow down.", {
          status: 429,
          retryable: true,
          retryAfterMs: 1500,
        }),
      )
      .mockResolvedValueOnce({ found: new Map(), missing: [1] });
    expect(await fillMaps({ lookup, sleep, now: () => T0 })).toEqual({
      asked: 1,
      filled: 0,
      missing: 1,
      error: null,
    });
    expect(sleep).toHaveBeenCalledWith(1500);
  });

  it("gives up after three tries, and at once on an error it can't retry", async () => {
    await seedMapsRange(1);
    const busy = vi
      .fn<MapLookup>()
      .mockRejectedValue(new HinaiError("osu_api_shed", "Busy.", { status: 429, retryable: true }));
    expect(await fillMaps({ lookup: busy, sleep: noWait })).toMatchObject({
      asked: 0,
      error: "The mirror stopped the map fill: Busy.",
    });
    expect(busy).toHaveBeenCalledTimes(3);
    const refused = vi
      .fn<MapLookup>()
      .mockRejectedValue(new HinaiError("too_many_ids", "Too many ids.", { status: 400 }));
    expect(await fillMaps({ lookup: refused, sleep: noWait })).toMatchObject({
      error: "The mirror stopped the map fill: Too many ids.",
    });
    expect(refused).toHaveBeenCalledTimes(1);
  });
});
