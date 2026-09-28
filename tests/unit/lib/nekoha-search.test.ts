/**
 * @file tests/unit/lib/nekoha-search.test.ts
 * @desc The mirror's search of its mod data, never the real one (msw): the request (the lens,
 *       the status always, osu!standard, the text, the star range under the lens, the sort, 50
 *       from pools' page as the mirror's own 1-based page, pools' User-Agent); rows parsed with
 *       unknown fields ignored and rows that don't parse dropped; an empty page as an answer;
 *       every way the mirror fails (an error status, Cloudflare HTML, ready false, success
 *       false, no rows list, another lens than asked, a dropped connection, a timeout) as a
 *       failure; and a Retry-After skipping the mirror meanwhile.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

import { delay, HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { NEKOHA_SEARCH_URL } from "@/constants/browse";
import { SERVER_USER_AGENT } from "@/constants/site";
import { resetMirrorCooldown } from "@/lib/map-search";
import { type NekohaQuery, nekohaSearchUrl, searchNekoha } from "@/lib/nekoha-search";
import { setupMsw } from "../../helpers/msw";
import { type MirrorCall, nekohaAnswer, nekohaHandler, nekohaRow } from "../../helpers/nekoha";

const server = setupMsw();
beforeEach(resetMirrorCooldown);

const DT: NekohaQuery = { lens: "DT", status: "ranked", q: "", sr: null, page: 1 };

describe("nekohaSearchUrl", () => {
  it("asks for 50 ranked osu!standard rows under the lens, most favourited first", () => {
    const url = new URL(nekohaSearchUrl({ ...DT, lens: "NM" }));
    expect(url.origin + url.pathname).toBe(NEKOHA_SEARCH_URL);
    expect(Object.fromEntries(url.searchParams)).toEqual({
      mods: "NM",
      status: "ranked",
      mode: "0",
      sort: "favourites_desc",
      limit: "50",
      page: "1",
    });
  });

  it("sends the text, the star range under the lens and pools' page as it is", () => {
    const url = new URL(
      nekohaSearchUrl({ lens: "HDHR", status: "graveyard", q: "xeroa", sr: [5.5, 6.5], page: 3 }),
    );
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      mods: "HDHR",
      status: "graveyard",
      q: "xeroa",
      min_stars: "5.5",
      max_stars: "6.5",
      page: "3",
    });
  });

  it("leaves out a bottom end at the slider's minimum and an open top end", () => {
    const low = new URL(nekohaSearchUrl({ ...DT, sr: [0, 6] })).searchParams;
    expect([low.get("min_stars"), low.get("max_stars")]).toEqual([null, "6"]);
    const high = new URL(nekohaSearchUrl({ ...DT, sr: [7, null] })).searchParams;
    expect([high.get("min_stars"), high.get("max_stars")]).toEqual(["7", null]);
  });
});

describe("searchNekoha", () => {
  it("sends pools' User-Agent and reads each row", async () => {
    const calls: MirrorCall[] = [];
    server.use(nekohaHandler(() => nekohaAnswer([nekohaRow(11, 1)], { total: 120 }), calls));
    const result = await searchNekoha(DT);
    expect(calls[0]?.userAgent).toBe(SERVER_USER_AGENT);
    expect(result).toEqual({
      ok: true,
      received: 1,
      total: 120,
      rows: [
        {
          id: 11,
          setId: 1,
          artist: "Compact Artist",
          title: "Xeroa",
          creator: "Mapper",
          version: "Diff 11",
          status: "ranked",
          stars: 6.2,
          starsNoMod: 4.5,
          bpm: 180,
          length: 120,
        },
      ],
    });
  });

  it("drops rows it can't read, and rows for other modes", async () => {
    server.use(
      nekohaHandler(() =>
        nekohaAnswer([
          nekohaRow(11, 1),
          nekohaRow(12, 1, { mode: 1 }),
          nekohaRow(13, 1, { stars: "hard" }),
          { beatmap_id: 14 },
        ]),
      ),
    );
    const result = await searchNekoha(DT);
    expect(result.ok && result.rows.map((row) => row.id)).toEqual([11]);
    expect(result.ok && result.received).toBe(4);
  });

  it("answers an empty page as a page", async () => {
    server.use(nekohaHandler(() => nekohaAnswer([], { total: 0 })));
    expect(await searchNekoha(DT)).toEqual({ ok: true, rows: [], received: 0, total: 0 });
  });
});

describe("searchNekoha when the mirror fails", () => {
  it.each([
    ["a 503", () => HttpResponse.json({ error: "busy" }, { status: 503 })],
    ["a 400", () => HttpResponse.json({ error: "bad" }, { status: 400 })],
    ["Cloudflare HTML", () => new HttpResponse("<html>502</html>", { status: 200 })],
    ["ready false", () => nekohaAnswer([], { ready: false })],
    ["success false", () => nekohaAnswer([nekohaRow(11, 1)], { success: false })],
    ["no rows list", () => HttpResponse.json({ success: true, ready: true, total: 3 })],
    ["no total", () => HttpResponse.json({ success: true, ready: true, mod: "DT", maps: [] })],
    ["another lens", () => nekohaAnswer([nekohaRow(11, 1)], { mod: "NM" })],
    ["a dropped connection", () => HttpResponse.error()],
  ])("fails on %s", async (_name, answer) => {
    server.use(nekohaHandler(answer));
    expect(await searchNekoha(DT)).toMatchObject({ ok: false });
  });

  it("fails on a timeout", async () => {
    server.use(
      http.get(NEKOHA_SEARCH_URL, async () => {
        await delay(200);
        return nekohaAnswer([]);
      }),
    );
    expect(await searchNekoha(DT, { timeoutMs: 20 })).toMatchObject({ ok: false });
  });

  it("skips the mirror while a Retry-After it sent runs", async () => {
    const calls: MirrorCall[] = [];
    server.use(
      nekohaHandler(
        () =>
          HttpResponse.json({ error: "slow" }, { status: 429, headers: { "Retry-After": "20" } }),
        calls,
      ),
    );
    expect(await searchNekoha(DT)).toMatchObject({ ok: false });
    expect(await searchNekoha(DT)).toMatchObject({ ok: false });
    expect(calls).toHaveLength(1);
    const later = Date.now() + 21_000;
    server.use(nekohaHandler(() => nekohaAnswer([]), calls));
    expect(await searchNekoha(DT, { now: () => later })).toMatchObject({ ok: true });
    expect(calls).toHaveLength(2);
  });
});
