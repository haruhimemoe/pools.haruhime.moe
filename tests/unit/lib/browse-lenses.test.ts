/**
 * @file tests/unit/lib/browse-lenses.test.ts
 * @desc The lenses the map browser offers, never from the real mirror (msw): the spec's combos
 *       the mirror's pp-maps/stats also lists, in picker order, NM always; kept an hour (one
 *       call for requests at once); every way the list can't be read (an error status, HTML, no
 *       available_mods, a dropped connection, a Retry-After running) answered with the
 *       built-in list, asked again after a minute.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

import { HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { BROWSE_LENSES } from "@/constants/browse";
import { SERVER_USER_AGENT } from "@/constants/site";
import { availableLenses, resetLensList } from "@/lib/browse-lenses";
import { noteMirrorRetryAfter, resetMirrorCooldown } from "@/lib/map-search";
import { setupMsw } from "../../helpers/msw";
import { lensStats, lensStatsHandler, type MirrorCall } from "../../helpers/nekoha";

const server = setupMsw();
beforeEach(() => {
  resetMirrorCooldown();
  resetLensList();
});

/** The live list, less HT and EZHT. */
const LISTED = ["DT", "EZ", "EZDT", "FL", "HD", "HDDT", "HDHR", "HDHRDT", "HR", "HRDT", "NM"];

describe("availableLenses", () => {
  it("offers the spec's lenses the mirror lists, in picker order", async () => {
    const calls: MirrorCall[] = [];
    server.use(lensStatsHandler(() => lensStats(LISTED), calls));
    expect(await availableLenses()).toEqual(
      BROWSE_LENSES.filter((lens) => lens !== "HT" && lens !== "EZHT"),
    );
    expect(calls[0]?.userAgent).toBe(SERVER_USER_AGENT);
  });

  it("always offers NM", async () => {
    server.use(lensStatsHandler(() => lensStats(["DT"])));
    expect(await availableLenses()).toEqual(["NM", "DT"]);
  });

  it("keeps the list an hour, with one call for requests at once", async () => {
    const calls: MirrorCall[] = [];
    server.use(lensStatsHandler(() => lensStats(LISTED), calls));
    const start = Date.now();
    await Promise.all([
      availableLenses({ now: () => start }),
      availableLenses({ now: () => start }),
    ]);
    await availableLenses({ now: () => start + 3_599_000 });
    expect(calls).toHaveLength(1);
    await availableLenses({ now: () => start + 3_601_000 });
    expect(calls).toHaveLength(2);
  });

  it.each([
    ["a 503", () => HttpResponse.json({ error: "busy" }, { status: 503 })],
    ["HTML", () => new HttpResponse("<html>502</html>", { status: 200 })],
    ["no available_mods", () => HttpResponse.json({ success: true })],
    ["a dropped connection", () => HttpResponse.error()],
  ])("offers the built-in list on %s, asking again after a minute", async (_name, answer) => {
    const calls: MirrorCall[] = [];
    server.use(lensStatsHandler(answer, calls));
    const start = Date.now();
    expect(await availableLenses({ now: () => start })).toEqual(BROWSE_LENSES);
    await availableLenses({ now: () => start + 59_000 });
    expect(calls).toHaveLength(1);
    await availableLenses({ now: () => start + 61_000 });
    expect(calls).toHaveLength(2);
  });

  it("offers the built-in list without asking while a Retry-After runs", async () => {
    const calls: MirrorCall[] = [];
    server.use(lensStatsHandler(() => lensStats(["NM"]), calls));
    noteMirrorRetryAfter(
      new Response(null, { status: 429, headers: { "Retry-After": "30" } }),
      Date.now(),
    );
    expect(await availableLenses()).toEqual(BROWSE_LENSES);
    expect(calls).toHaveLength(0);
  });
});
