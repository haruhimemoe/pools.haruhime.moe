/**
 * @file tests/unit/lib/map-search.test.ts
 * @desc The mirror's search, never the real one (msw): the request (osu!standard, the status
 *       unless Any, star, BPM and length ranges, explicit=show only when asked, pools' page 1 as
 *       the mirror's page 0, 50 a page, pools' User-Agent); answers parsed with unknown fields
 *       ignored, a set that doesn't parse dropped and non-standard difficulties left out; every
 *       way the mirror fails (an error body with no sets, 400 invalid_explicit, 503, 429 with
 *       Retry-After, Cloudflare HTML, a dropped connection, a timeout) as a failure, never as
 *       0 maps; and page counts from total_count, from osu!'s capped total, or from a full page.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sat Sep 26, 2026
 * @modified Sat Sep 26, 2026
 */

import { delay, HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { MIRROR_SEARCH_URL } from "@/constants/search";
import { SERVER_USER_AGENT } from "@/constants/site";
import { mirrorPageCount, mirrorSearchUrl, searchMirror } from "@/lib/map-search";
import { EMPTY_ALL_MAP_FILTERS } from "@/utils/search-params";
import {
  compactSet,
  fixtureSet,
  mirrorSearchHandler,
  type SearchCall,
  searchAnswer,
} from "../../helpers/mirror-search";
import { setupMsw } from "../../helpers/msw";

const server = setupMsw();

describe("mirrorSearchUrl", () => {
  it("asks for osu!standard ranked maps, 50 from the mirror's page 0, explicit ones hidden", () => {
    const url = new URL(mirrorSearchUrl(EMPTY_ALL_MAP_FILTERS, 1));
    expect(Object.fromEntries(url.searchParams)).toEqual({
      mode: "0",
      status: "ranked",
      page: "0",
      limit: "50",
    });
  });

  it("sends the text, ranges and Show explicit maps, and no status for Any", () => {
    const url = new URL(
      mirrorSearchUrl(
        {
          q: "freedom dive",
          status: "any",
          sr: [6.5, null],
          len: [60, 300],
          bpm: [180, 240],
          explicit: true,
        },
        3,
      ),
    );
    expect(Object.fromEntries(url.searchParams)).toEqual({
      query: "freedom dive",
      mode: "0",
      min_stars: "6.5",
      min_length: "60",
      max_length: "300",
      min_bpm: "180",
      max_bpm: "240",
      explicit: "show",
      page: "2",
      limit: "50",
    });
  });
});

describe("searchMirror", () => {
  it("sends pools' User-Agent and reads the sets, dropping what doesn't parse", async () => {
    const calls: SearchCall[] = [];
    const taiko = { ...compactSet(9, 90), beatmaps: [{ id: 91, mode: "taiko" }] };
    server.use(
      mirrorSearchHandler(
        () =>
          searchAnswer(
            [
              { ...fixtureSet(1), extra_field: { anything: true } },
              { id: "not a number" },
              compactSet(8, 80),
              taiko,
            ],
            { total_count: 3 },
          ),
        calls,
      ),
    );
    const result = await searchMirror(EMPTY_ALL_MAP_FILTERS, 1);
    expect(calls[0]?.userAgent).toBe(SERVER_USER_AGENT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.sets.map((set) => set.id)).toEqual([1, 8, 9]);
    expect(result.sets[2]?.beatmaps).toEqual([]);
    expect(result.sets[1]?.beatmaps).toEqual([
      { id: 80, version: "Hard", stars: 4.5, length: 90, bpm: 150 },
    ]);
    expect(result).toMatchObject({ received: 4, total: 3 });
  });

  it.each([
    [
      "an error body with no sets",
      () =>
        HttpResponse.json({
          error: "All beatmap sources unavailable",
          sources_tried: ["local", "osu", "osu.direct"],
        }),
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
        new HttpResponse("<!DOCTYPE html><title>502 Bad gateway</title>", {
          status: 200,
          headers: { "content-type": "text/html" },
        }),
    ],
    ["a dropped connection", () => HttpResponse.error()],
  ])("fails on %s", async (_label, answer) => {
    server.use(mirrorSearchHandler(answer));
    expect(await searchMirror(EMPTY_ALL_MAP_FILTERS, 1)).toMatchObject({ ok: false });
  });

  it("fails when the mirror takes too long", async () => {
    server.use(
      http.get(MIRROR_SEARCH_URL, async () => {
        await delay(200);
        return searchAnswer([]);
      }),
    );
    expect(await searchMirror(EMPTY_ALL_MAP_FILTERS, 1, { timeoutMs: 20 })).toMatchObject({
      ok: false,
    });
  });

  it("reads a page past the end as an empty page, not a failure", async () => {
    server.use(mirrorSearchHandler(() => searchAnswer([], { total_count: 40 })));
    expect(await searchMirror(EMPTY_ALL_MAP_FILTERS, 9)).toEqual({
      ok: true,
      sets: [],
      received: 0,
      total: 40,
    });
  });

  it("takes osu!'s total, capped at 10000, and no total from osu.direct", async () => {
    server.use(mirrorSearchHandler(() => searchAnswer([], { source: "osu", total: 25_000 })));
    expect(await searchMirror(EMPTY_ALL_MAP_FILTERS, 1)).toMatchObject({ total: 10_000 });
    server.use(mirrorSearchHandler(() => searchAnswer([], { source: "osu.direct" })));
    expect(await searchMirror(EMPTY_ALL_MAP_FILTERS, 1)).toMatchObject({ total: null });
  });
});

describe("mirrorPageCount", () => {
  it("counts pages from a total, capped at 200", () => {
    expect(mirrorPageCount({ total: 120, received: 50, page: 1 })).toBe(3);
    expect(mirrorPageCount({ total: 10_000, received: 50, page: 1 })).toBe(200);
    expect(mirrorPageCount({ total: 0, received: 0, page: 1 })).toBe(0);
  });

  it("offers one more page after a full page when there's no total", () => {
    expect(mirrorPageCount({ total: null, received: 50, page: 4 })).toBe(5);
    expect(mirrorPageCount({ total: null, received: 12, page: 4 })).toBe(4);
    expect(mirrorPageCount({ total: null, received: 50, page: 200 })).toBe(200);
  });
});
