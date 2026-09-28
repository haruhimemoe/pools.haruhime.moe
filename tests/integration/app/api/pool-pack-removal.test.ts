/**
 * @file tests/integration/app/api/pool-pack-removal.test.ts
 * @desc A packs outage never blocks a pool going private or being deleted: the change happens,
 *       the pack removal is queued, and the answer says so (`packRemoval: "queued"` and a
 *       notice). With packs answering, DELETE is a plain 204 and going private sends the pool
 *       alone.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

import { HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE } from "@/app/api/pools/[id]/route";
import { PUT } from "@/app/api/pools/[id]/visibility/route";
import { PACK_REMOVAL_QUEUED } from "@/constants/built-pools";
import { findBuiltPool } from "@/services/built-pools";
import { packCleanupCollection } from "@/services/pack-cleanup";
import { setupTestDb } from "../../../helpers/db";
import { setupMsw } from "../../../helpers/msw";
import { packsDeleteHandler, TEST_SERVICE } from "../../../helpers/packs-server";
import { createCast, insertPool, params, poolRequest } from "../../../helpers/pool-requests";

setupTestDb();
const server = setupMsw();
beforeEach(() => {
  vi.stubEnv("POOLS_SERVICE_TOKEN", TEST_SERVICE.token);
  vi.stubEnv("PACKS_URL", TEST_SERVICE.url);
});
afterEach(() => {
  vi.stubEnv("POOLS_SERVICE_TOKEN", "");
  vi.stubEnv("PACKS_URL", "");
});

const ID = "b-a0000001";
const at = params({ id: ID });
const SYNCED = { state: "synced" as const, slug: "Abc123", syncedAt: new Date(), error: null };
const packsDown = () =>
  server.use(packsDeleteHandler(() => HttpResponse.json({}, { status: 503 })));

const setup = async () => {
  const cast = await createCast();
  await insertPool(cast, { _id: ID, visibility: "public", pack: SYNCED });
  return cast;
};

describe("DELETE /api/pools/<id> with packs down", () => {
  it("deletes the pool, queues the pack's removal and says so", async () => {
    const cast = await setup();
    packsDown();
    const response = await DELETE(poolRequest("DELETE", `/api/pools/${ID}`, cast.owner.cookie), at);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ packRemoval: "queued", notice: PACK_REMOVAL_QUEUED });
    expect(await findBuiltPool(ID)).toBeNull();
    expect(await (await packCleanupCollection()).countDocuments({ ref: ID })).toBe(1);
  });

  it("is a plain 204 when packs removes the pack", async () => {
    const cast = await setup();
    server.use(packsDeleteHandler());
    const response = await DELETE(poolRequest("DELETE", `/api/pools/${ID}`, cast.owner.cookie), at);
    expect(response.status).toBe(204);
  });
});

describe("PUT /api/pools/<id>/visibility with packs down", () => {
  const goPrivate = (cookie: string) =>
    PUT(poolRequest("PUT", `/api/pools/${ID}/visibility`, cookie, { visibility: "private" }), at);

  it("makes the pool private, queues the pack's removal and says so", async () => {
    const cast = await setup();
    packsDown();
    const response = await goPrivate(cast.owner.cookie);
    expect(response.status).toBe(200);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body).toMatchObject({
      pool: { visibility: "private", pack: { state: "none" } },
      packRemoval: "queued",
      notice: PACK_REMOVAL_QUEUED,
    });
  });

  it("sends the pool alone when packs removes the pack", async () => {
    const cast = await setup();
    server.use(packsDeleteHandler());
    const body = (await (await goPrivate(cast.owner.cookie)).json()) as Record<string, unknown>;
    expect(Object.keys(body)).toEqual(["pool"]);
  });
});
