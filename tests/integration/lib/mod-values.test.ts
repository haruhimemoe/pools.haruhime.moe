/**
 * @file tests/integration/lib/mod-values.test.ts
 * @desc Values under mods from a stand-in mirror (msw) and the mod_values cache: asked with
 *       pools' User-Agent and the combo, at most 100 ids a call, kept per id and combo (a second
 *       ask is a cache hit), ids the mirror lacks answered missing and never cached, and every
 *       way the mirror fails (an error status, a body that isn't the answer, success false,
 *       another combo than asked, a dropped connection, a Retry-After) answered missing with
 *       nothing cached. The TTL index keeps rows 30 days.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

import { HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { MOD_VALUES_INDEXES } from "@/constants/db";
import { MOD_VALUES_TTL_SECONDS } from "@/constants/mod-values";
import { SERVER_USER_AGENT } from "@/constants/site";
import { resetMirrorCooldown } from "@/lib/map-search";
import { getModValues } from "@/lib/mod-values";
import { modValuesCollection } from "@/models/ModValues";
import { setupTestDb } from "../../helpers/db";
import { setupMsw } from "../../helpers/msw";
import { type BatchCall, ppBatchAnswering, ppBatchHandler, ppValues } from "../../helpers/pp-batch";

setupTestDb();
const server = setupMsw();
beforeEach(resetMirrorCooldown);

/** The mirror knows every id below 1000, with stars = id / 100 under any combo. */
const knowing = (calls: BatchCall[] = []) =>
  server.use(
    ppBatchHandler((id) => (id < 1000 ? ppValues({ stars: id / 100 }) : undefined), calls),
  );

describe("getModValues", () => {
  it("asks the mirror with pools' User-Agent and the combo, and answers each id's values", async () => {
    const calls: BatchCall[] = [];
    knowing(calls);
    const result = await getModValues([100, 200], "DT");
    expect(calls).toEqual([{ ids: [100, 200], mods: "DT", userAgent: SERVER_USER_AGENT }]);
    expect(result.failed).toBe(false);
    expect(result.missing).toEqual([]);
    expect(result.values.get(200)).toEqual({ stars: 2, ar: 9, od: 8, cs: 4, bpm: 180 });
  });

  it("asks at most 100 ids a call, each id once", async () => {
    const calls: BatchCall[] = [];
    knowing(calls);
    const ids = Array.from({ length: 150 }, (_, i) => i + 1);
    const result = await getModValues([...ids, 1, 2], "HR");
    expect(calls.map((call) => call.ids.length).sort((a, b) => b - a)).toEqual([100, 50]);
    expect(result.values.size).toBe(150);
  });

  it("answers a second ask from the cache, per id and combo", async () => {
    const calls: BatchCall[] = [];
    knowing(calls);
    await getModValues([100, 200], "HDHR");
    const again = await getModValues([200, 100], "HDHR");
    expect(calls).toHaveLength(1);
    expect(again.values.get(100)).toEqual({ stars: 1, ar: 9, od: 8, cs: 4, bpm: 180 });
    await getModValues([100, 300], "DT");
    expect(calls.slice(1).map((call) => [call.ids, call.mods])).toEqual([[[100, 300], "DT"]]);
    const stored = await (await modValuesCollection()).findOne({ _id: "100:HDHR" });
    expect(stored).toMatchObject({ beatmapId: 100, mods: "HDHR", stars: 1 });
  });

  it("reads a combo in any order and NC as DT", async () => {
    const calls: BatchCall[] = [];
    knowing(calls);
    await getModValues([100], "hrhd");
    await getModValues([100], "NC");
    expect(calls.map((call) => call.mods)).toEqual(["HDHR", "DT"]);
  });

  it("answers ids the mirror lacks as missing, and asks for them again next time", async () => {
    const calls: BatchCall[] = [];
    knowing(calls);
    const result = await getModValues([100, 5000], "DT");
    expect(result).toMatchObject({ failed: false, missing: [5000] });
    await getModValues([100, 5000], "DT");
    expect(calls.map((call) => call.ids)).toEqual([[100, 5000], [5000]]);
    expect(await (await modValuesCollection()).countDocuments()).toBe(1);
  });

  it("answers an empty list without asking", async () => {
    const calls: BatchCall[] = [];
    knowing(calls);
    expect(await getModValues([], "DT")).toEqual({ values: new Map(), missing: [], failed: false });
    expect(calls).toHaveLength(0);
  });

  it("refuses a combo that isn't one", async () => {
    await expect(getModValues([100], "EZHR")).rejects.toThrow(RangeError);
  });
});

describe("getModValues when the mirror fails", () => {
  it.each([
    ["a 503", () => HttpResponse.json({ error: "busy" }, { status: 503 })],
    ["a body with no results", () => HttpResponse.json({ error: "nope" })],
    ["success false", () => HttpResponse.json({ success: false, results: {}, mods: "DT" })],
    ["another combo", () => HttpResponse.json({ results: { 100: ppValues() }, mods: "NM" })],
    ["HTML", () => new HttpResponse("<html>Bad gateway</html>", { status: 200 })],
    ["a dropped connection", () => HttpResponse.error()],
  ])("answers every id missing and caches nothing on %s", async (_name, answer) => {
    server.use(ppBatchAnswering(answer));
    const result = await getModValues([100, 200], "DT");
    expect(result).toEqual({ values: new Map(), missing: [100, 200], failed: true });
    expect(await (await modValuesCollection()).countDocuments()).toBe(0);
  });

  it("answers a row it can't read as missing, keeping the rest", async () => {
    server.use(
      ppBatchAnswering(() =>
        HttpResponse.json({
          results: { 100: ppValues(), 200: ppValues({ stars: null }) },
          missing: [],
          mods: "DT",
        }),
      ),
    );
    const result = await getModValues([100, 200], "DT");
    expect(result).toMatchObject({ failed: false, missing: [200] });
    expect([...result.values.keys()]).toEqual([100]);
  });

  it("skips the mirror while its Retry-After runs, still answering from the cache", async () => {
    knowing();
    await getModValues([100], "DT");
    const calls: BatchCall[] = [];
    server.use(
      ppBatchAnswering(
        () =>
          HttpResponse.json(
            { error: "slow down" },
            { status: 429, headers: { "Retry-After": "30" } },
          ),
        calls,
      ),
    );
    expect((await getModValues([200], "DT")).failed).toBe(true);
    const cooling = await getModValues([100, 300], "DT");
    expect(calls).toHaveLength(1);
    expect(cooling).toMatchObject({ failed: true, missing: [300] });
    expect(cooling.values.get(100)).toMatchObject({ stars: 1 });
  });
});

describe("the mod_values collection", () => {
  it("drops rows 30 days after they were fetched", async () => {
    const indexes = await (await modValuesCollection()).indexes();
    expect(indexes.find((index) => index.name === MOD_VALUES_INDEXES.ttl)).toMatchObject({
      key: { fetchedAt: 1 },
      expireAfterSeconds: MOD_VALUES_TTL_SECONDS,
    });
    expect(MOD_VALUES_TTL_SECONDS).toBe(30 * 24 * 60 * 60);
  });
});
