/**
 * @file tests/integration/app/api/search.test.ts
 * @desc GET /api/search: answers pools or maps with 5 minutes of CDN caching and no stale
 *       answers (so a pool an admin hides leaves search within 5 minutes), a 300-character paste
 *       of regex characters and full-width letters as 200, a bad map reference as 400 no-store,
 *       60 requests a minute per IP then 429 with Retry-After and no-store (another IP
 *       unaffected), and reads no cookies. All maps (a stand-in mirror, msw): sets that can't be
 *       used hidden and counted, cached like any search; every way the mirror fails (an error
 *       body with no sets, 400 invalid_explicit, 503, 429, Cloudflare HTML) as 503 no-store
 *       with the fixed sentence, never "0 maps"; while a Retry-After the mirror sent runs,
 *       the same answer without asking it.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Mon Sep 28, 2026
 */

import { readFileSync } from "node:fs";
import { HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/search/route";
import { ALL_MAPS_FAILED } from "@/constants/search";
import { resetMirrorCooldown } from "@/lib/map-search";
import { builtPoolsCollection } from "@/models/BuiltPool";
import { poolsCollection } from "@/models/Pool";
import { builtSearchFields } from "@/utils/built-record";
import { makeBuiltPool } from "../../../helpers/built-pools";
import { setupTestDb } from "../../../helpers/db";
import {
  fixtureSet,
  mirrorSearchHandler,
  type SearchCall,
  searchAnswer,
} from "../../../helpers/mirror-search";
import { setupMsw } from "../../../helpers/msw";
import { makePool } from "../../../helpers/records";

setupTestDb();
const server = setupMsw();
beforeEach(resetMirrorCooldown);

const get = (query: string, ip = "203.0.113.7") =>
  GET(new Request(`http://localhost:3000/api/search?${query}`, { headers: { "x-real-ip": ip } }));

describe("GET /api/search", () => {
  it("answers visible pools, cached 5 minutes on the CDN and never served stale", async () => {
    await (await poolsCollection()).insertMany([
      makePool({ _id: "otdb-1" }),
      makePool({ _id: "otdb-2", hidden: true, slots: [{ mod: "HD", index: 1, beatmapId: 5 }] }),
    ]);
    const response = await get("q=spring");
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("public, s-maxage=300");
    const body = (await response.json()) as {
      tab: string;
      total: number;
      results: { id: string }[];
    };
    expect(body).toMatchObject({ tab: "pools", total: 1 });
    expect(body.results.map((result) => result.id)).toEqual(["otdb-1"]);
  });

  it("answers pools built here for type=built, and past pools for a link without a type", async () => {
    await (await poolsCollection()).insertOne(makePool({ _id: "otdb-1" }));
    const slots = [{ mod: "NM", index: 1, beatmapId: 5 }];
    const pool = makeBuiltPool({ visibility: "public", name: "Spring Build", slots });
    await (await builtPoolsCollection()).insertOne({ ...pool, ...builtSearchFields(pool) });
    const ids = async (query: string) =>
      ((await (await get(query)).json()) as { results: { id: string }[] }).results.map(
        (result) => result.id,
      );
    expect(await ids("q=spring")).toEqual(["otdb-1"]);
    expect(await ids("type=built&q=spring")).toEqual(["b-a0000001"]);
    expect(await ids("type=both&q=spring")).toEqual(["b-a0000001", "otdb-1"]);
  });

  it("answers maps played in pools on the maps tab's played scope", async () => {
    const body = (await (await get("tab=maps&scope=played")).json()) as { scope: string };
    expect(body).toMatchObject({ tab: "maps", scope: "played" });
  });

  it("answers a 300-character paste of regex characters and full-width letters, never a 500", async () => {
    const paste = "([C++ osu! ＯＷＣ".repeat(22).slice(0, 300);
    expect(paste).toHaveLength(300);
    const response = await get(`q=${encodeURIComponent(paste)}`);
    expect(response.status).toBe(200);
    expect(((await response.json()) as { tab: string }).tab).toBe("pools");
  });

  it("refuses a set link as the contained map, uncached", async () => {
    const response = await get("map=https%3A%2F%2Fosu.ppy.sh%2Fbeatmapsets%2F39804");
    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("allows 60 requests a minute per IP", async () => {
    for (let i = 0; i < 60; i++) expect((await get("", "198.51.100.1")).status).toBe(200);
    const refused = await get("", "198.51.100.1");
    expect(refused.status).toBe(429);
    expect(refused.headers.get("retry-after")).toMatch(/^\d+$/);
    expect(refused.headers.get("cache-control")).toBe("no-store");
    expect((await get("", "198.51.100.2")).status).toBe(200);
  });

  it("reads no cookies", () => {
    expect(readFileSync("src/app/api/search/route.ts", "utf8")).not.toMatch(
      /cookies|getUserFromHeaders/,
    );
  });
});

describe("GET /api/search, all maps", () => {
  it("answers the page with hidden sets counted, cached like any search", async () => {
    server.use(
      mirrorSearchHandler(() =>
        searchAnswer([fixtureSet(1), fixtureSet(101), fixtureSet(103)], { total_count: 3 }),
      ),
    );
    const response = await get("tab=maps&status=any");
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("public, s-maxage=300");
    const body = (await response.json()) as { results: { setId: number }[] };
    expect(body).toMatchObject({ tab: "maps", scope: "all", total: 3, hidden: 2 });
    expect(body.results.map((set) => set.setId)).toEqual([1]);
  });

  it.each([
    [
      "an error body with no sets",
      () => HttpResponse.json({ error: "All beatmap sources unavailable", sources_tried: [] }),
    ],
    [
      "400 invalid_explicit",
      () => HttpResponse.json({ error: "bad", code: "invalid_explicit" }, { status: 400 }),
    ],
    ["503", () => HttpResponse.json({ error: "degraded" }, { status: 503 })],
    [
      "429 with Retry-After",
      () => new HttpResponse(null, { status: 429, headers: { "Retry-After": "30" } }),
    ],
    [
      "Cloudflare HTML",
      () =>
        new HttpResponse("<html><body>Bad gateway</body></html>", {
          status: 502,
          headers: { "content-type": "text/html" },
        }),
    ],
  ])("answers the fixed sentence, uncached, when the mirror sends %s", async (_label, answer) => {
    server.use(mirrorSearchHandler(answer));
    const response = await get("tab=maps&q=dive");
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      error: { code: "mirror_unavailable", message: ALL_MAPS_FAILED },
    });
  });

  it("answers the fixed sentence without asking the mirror while its Retry-After runs", async () => {
    const calls: SearchCall[] = [];
    server.use(
      mirrorSearchHandler(
        () => new HttpResponse(null, { status: 429, headers: { "Retry-After": "30" } }),
        calls,
      ),
    );
    expect((await get("tab=maps&q=dive")).status).toBe(503);
    server.use(mirrorSearchHandler(() => searchAnswer([fixtureSet(1)]), calls));
    const response = await get("tab=maps&q=blue");
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toMatchObject({ error: { message: ALL_MAPS_FAILED } });
    expect(calls).toHaveLength(1);
  });
});
