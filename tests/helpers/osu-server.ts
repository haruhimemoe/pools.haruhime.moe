/**
 * @file tests/helpers/osu-server.ts
 * @desc A stand-in for osu!'s API: the client-credentials token and GET /api/v2/beatmaps answered
 *       from tests/fixtures/osu/compliance-beatmaps.json (ids it doesn't have are left out, as
 *       osu! does), counting the /beatmaps calls.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { HttpResponse, http } from "msw";
import fixture from "../fixtures/osu/compliance-beatmaps.json" with { type: "json" };

export const osuCalls = { beatmaps: 0 };

export const osuHandlers = [
  http.post("https://osu.ppy.sh/oauth/token", () =>
    HttpResponse.json({ access_token: "osu-test-token", token_type: "Bearer", expires_in: 86400 }),
  ),
  http.get("https://osu.ppy.sh/api/v2/beatmaps", ({ request }) => {
    osuCalls.beatmaps += 1;
    const ids = new URL(request.url).searchParams.getAll("ids[]").map(Number);
    return HttpResponse.json({
      beatmaps: fixture.beatmaps.filter((row) => ids.includes(row.id)),
    });
  }),
];
