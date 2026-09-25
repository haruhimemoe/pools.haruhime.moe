/**
 * @file tests/integration/app/api/search.test.ts
 * @desc GET /api/search: answers pools or maps with 5 minutes of CDN caching and no stale
 *       answers (so a pool an admin hides leaves search within 5 minutes), a 300-character paste
 *       of regex characters and full-width letters as 200, a bad map reference as 400 no-store,
 *       60 requests a minute per IP then 429 with Retry-After and no-store (another IP
 *       unaffected), and reads no cookies.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/search/route";
import { poolsCollection } from "@/models/Pool";
import { setupTestDb } from "../../../helpers/db";
import { makePool } from "../../../helpers/records";

setupTestDb();

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

  it("answers maps on the maps tab", async () => {
    const body = (await (await get("tab=maps")).json()) as { tab: string };
    expect(body.tab).toBe("maps");
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
