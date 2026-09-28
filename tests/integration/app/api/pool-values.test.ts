/**
 * @file tests/integration/app/api/pool-values.test.ts
 * @desc GET /api/pools/<id>/values: each slot's values under its mods, keyed by map and combo,
 *       for the pool's owner and editors (signed out 401, can't see it 404, sees it but can't
 *       edit 403), within the per-user ops limit, never cached; a failed mirror call still
 *       answers, with complete false.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

import { HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/pools/[id]/values/route";
import { resetMirrorCooldown } from "@/lib/map-search";
import { mapsCollection } from "@/models/Map";
import { ADMIN_OSU_ID } from "../../../helpers/auth";
import { setupTestDb } from "../../../helpers/db";
import { setupMsw } from "../../../helpers/msw";
import { createCast, insertPool, params, poolRequest } from "../../../helpers/pool-requests";
import { ppBatchAnswering, ppBatchHandler, ppValues } from "../../../helpers/pp-batch";
import { makeMap } from "../../../helpers/records";

setupTestDb();
const server = setupMsw();
beforeEach(() => {
  resetMirrorCooldown();
  vi.stubEnv("ADMIN_OSU_IDS", String(ADMIN_OSU_ID));
});

const ID = "b-a0000001";
const ask = (cookie: string | null) =>
  GET(poolRequest("GET", `/api/pools/${ID}/values`, cookie), params({ id: ID }));

const setup = async (visibility: "private" | "public" = "private") => {
  const cast = await createCast();
  await insertPool(cast, {
    _id: ID,
    visibility,
    slots: [
      { mod: "NM", index: 1, beatmapId: 1 },
      { mod: "DT", index: 1, beatmapId: 2 },
    ],
  });
  await (await mapsCollection()).insertMany([makeMap({ _id: 1 }), makeMap({ _id: 2 })]);
  return cast;
};

describe("GET /api/pools/<id>/values", () => {
  it("answers each slot's values by map and combo, never cached", async () => {
    const cast = await setup();
    server.use(ppBatchHandler(() => ppValues({ stars: 7.25 })));
    const response = await ask(cast.editor.cookie);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = (await response.json()) as { values: Record<string, unknown>; complete: boolean };
    expect(body.complete).toBe(true);
    expect(body.values["1:NM"]).toMatchObject({ stars: 5.5, source: "none" });
    expect(body.values["2:DT"]).toMatchObject({ stars: 7.25, bpm: 270, source: "mirror" });
  });

  it("still answers, incomplete, when the mirror fails", async () => {
    const cast = await setup();
    server.use(ppBatchAnswering(() => HttpResponse.json({}, { status: 503 })));
    const body = (await (await ask(cast.owner.cookie)).json()) as {
      values: Record<string, { source: string }>;
      complete: boolean;
    };
    expect(body.complete).toBe(false);
    expect(body.values["2:DT"]?.source).toBe("math");
  });

  it("is for the owner and editors only", async () => {
    const cast = await setup("public");
    expect((await ask(null)).status).toBe(401);
    expect((await ask(cast.other.cookie)).status).toBe(403);
    expect((await ask(cast.admin.cookie)).status).toBe(403);
    await insertPool(cast, { _id: "b-a0000002" });
    const hidden = await GET(
      poolRequest("GET", "/api/pools/b-a0000002/values", cast.other.cookie),
      params({ id: "b-a0000002" }),
    );
    expect(hidden.status).toBe(404);
  });
});
