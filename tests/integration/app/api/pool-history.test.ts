/**
 * @file tests/integration/app/api/pool-history.test.ts
 * @desc PUT /api/pools/<id>/history end to end: signed out is 401, cross-site is refused, an
 *       editor is 403, someone else is 404 on a private pool, and the owner gets 200 with the
 *       row's historyPublic set.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Oct 5, 2026
 * @modified Mon Oct 5, 2026
 */

import { describe, expect, it } from "vitest";
import { PUT } from "@/app/api/pools/[id]/history/route";
import { findBuiltPool } from "@/services/built-pool-read";
import { setupTestDb } from "../../../helpers/db";
import {
  type Cast,
  createCast,
  insertPool,
  params,
  poolRequest,
} from "../../../helpers/pool-requests";

setupTestDb();

const ID = "b-a0000001";

const send = (cast: Cast, who: keyof Cast, body: unknown, headers?: Record<string, string>) =>
  PUT(
    poolRequest("PUT", `/api/pools/${ID}/history`, cast[who].cookie, body, headers),
    params({ id: ID }),
  );

describe("PUT /api/pools/<id>/history", () => {
  it("wants a signed-in caller from this site", async () => {
    const cast = await createCast();
    await insertPool(cast, { _id: ID });
    const noCookie = await PUT(
      poolRequest("PUT", `/api/pools/${ID}/history`, null, { historyPublic: true }),
      params({ id: ID }),
    );
    expect(noCookie.status).toBe(401);
    const crossSite = await send(
      cast,
      "owner",
      { historyPublic: true },
      { origin: "https://evil.test" },
    );
    expect(crossSite.status).toBe(403);
  });

  it("refuses an editor and someone else on a private pool", async () => {
    const cast = await createCast();
    await insertPool(cast, { _id: ID });
    expect((await send(cast, "editor", { historyPublic: true })).status).toBe(403);
    expect((await send(cast, "other", { historyPublic: true })).status).toBe(404);
  });

  it("lets the owner set historyPublic", async () => {
    const cast = await createCast();
    await insertPool(cast, { _id: ID });
    const response = await send(cast, "owner", { historyPublic: true });
    expect(response.status).toBe(200);
    const { pool } = (await response.json()) as { pool: { version: number } };
    expect(pool.version).toBe(2);
    expect((await findBuiltPool(ID))?.historyPublic).toBe(true);
  });
});
