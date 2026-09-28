/**
 * @file tests/integration/app/api/maps-browse.test.ts
 * @desc GET /api/maps/browse against stand-in mirrors (msw): a page under the lens cached like
 *       search (5 minutes on the CDN, never stale); params read as the browser writes them,
 *       unreadable ones at their defaults; a page whose mod values failed answered but never
 *       cached; every mirror failure (an error status, ready false, a Retry-After running) as
 *       503 browse_unavailable, no-store; and the per-IP search limit (60 a minute) then 429.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Mon Sep 28, 2026
 */

import { setupMsw } from "@haruhimemoe/next-kit/testing";
import { HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/maps/browse/route";
import { BROWSE_FAILED, BROWSE_LENSES } from "@/constants/browse";
import { resetLensList } from "@/lib/browse-lenses";
import { resetMirrorCooldown } from "@/lib/map-search";
import type { BrowseResponse } from "@/utils/browse-params";
import { setupTestDb } from "../../../helpers/db";
import {
  lensStats,
  lensStatsHandler,
  type MirrorCall,
  nekohaAnswer,
  nekohaHandler,
  nekohaRow,
} from "../../../helpers/nekoha";
import { ppBatchAnswering, ppBatchHandler, ppValues } from "../../../helpers/pp-batch";

setupTestDb();
const server = setupMsw();
beforeEach(() => {
  resetMirrorCooldown();
  resetLensList();
  server.use(
    lensStatsHandler(() => lensStats([...BROWSE_LENSES])),
    ppBatchHandler(() => ppValues()),
  );
});

const get = (query: string, ip = "203.0.113.9") =>
  GET(
    new Request(`http://localhost:3000/api/maps/browse?${query}`, {
      headers: { "x-real-ip": ip },
    }),
  );

describe("GET /api/maps/browse", () => {
  it("answers a page under the lens, cached 5 minutes on the CDN", async () => {
    server.use(nekohaHandler(() => nekohaAnswer([nekohaRow(11, 1), nekohaRow(12, 1)])));
    const response = await get("lens=DT&excludeIds=12");
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("public, s-maxage=300");
    const body = (await response.json()) as BrowseResponse;
    expect(body).toMatchObject({ lens: "DT", status: "ranked", excluded: 1, hidden: 0 });
    expect(body.sets[0]?.diffs.map((diff) => [diff.id, diff.bpm, diff.source])).toEqual([
      [11, 270, "mirror"],
    ]);
  });

  it("reads unreadable params as their defaults", async () => {
    const calls: MirrorCall[] = [];
    server.use(nekohaHandler(() => nekohaAnswer([], { mod: "NM", total: 0 }), calls));
    const response = await get("lens=XX&status=any&page=-3&sr=9-2&excludeIds=a");
    expect(response.status).toBe(200);
    expect(Object.fromEntries(calls[0]?.url.searchParams ?? [])).toMatchObject({
      mods: "NM",
      status: "ranked",
      page: "1",
    });
    expect(calls[0]?.url.searchParams.has("min_stars")).toBe(false);
  });

  it("answers a page whose mod values failed, never cached", async () => {
    server.use(
      nekohaHandler(() => nekohaAnswer([nekohaRow(11, 1)])),
      ppBatchAnswering(() => HttpResponse.json({ error: "x" }, { status: 500 })),
    );
    const response = await get("lens=DT");
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = (await response.json()) as BrowseResponse;
    expect(body.sets[0]?.diffs[0]).toMatchObject({ ar: null, source: "math" });
  });
});

describe("GET /api/maps/browse failures", () => {
  it.each([
    ["an error status", () => HttpResponse.json({ error: "busy" }, { status: 502 })],
    ["ready false", () => nekohaAnswer([], { ready: false })],
    ["Cloudflare HTML", () => new HttpResponse("<html>502</html>", { status: 200 })],
  ])("answers 503 browse_unavailable, uncached, on %s", async (_name, answer) => {
    server.use(nekohaHandler(answer));
    const response = await get("lens=DT");
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      error: { code: "browse_unavailable", message: BROWSE_FAILED },
    });
  });

  it("answers 503 without asking the mirror while its Retry-After runs", async () => {
    const calls: MirrorCall[] = [];
    server.use(
      nekohaHandler(
        () =>
          HttpResponse.json({ error: "slow" }, { status: 429, headers: { "Retry-After": "30" } }),
        calls,
      ),
    );
    expect((await get("lens=DT")).status).toBe(503);
    const cooling = await get("lens=HR");
    expect(cooling.status).toBe(503);
    expect(((await cooling.json()) as { error: { code: string } }).error.code).toBe(
      "browse_unavailable",
    );
    expect(calls).toHaveLength(1);
  });

  it("allows 60 requests a minute per IP, then 429 with Retry-After", async () => {
    server.use(nekohaHandler(() => nekohaAnswer([], { mod: "NM", total: 0 })));
    for (let i = 0; i < 60; i++) expect((await get("", "198.51.100.9")).status).toBe(200);
    const refused = await get("", "198.51.100.9");
    expect(refused.status).toBe(429);
    expect(refused.headers.get("retry-after")).not.toBeNull();
    expect(refused.headers.get("cache-control")).toBe("no-store");
    expect((await get("", "198.51.100.10")).status).toBe(200);
  });
});
