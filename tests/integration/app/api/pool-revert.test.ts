/**
 * @file tests/integration/app/api/pool-revert.test.ts
 * @desc POST /api/pools/<id>/history/<rev>/revert end to end: signed out 401, cross-site refused,
 *       someone else on a private pool 404, an editor 200.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Oct 5, 2026
 * @modified Mon Oct 5, 2026
 */

import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/pools/[id]/history/[rev]/revert/route";
import { ensureHistory } from "@/services/built-pool-history";
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

const send = (cast: Cast, who: keyof Cast, rev: string, headers?: Record<string, string>) =>
  POST(
    poolRequest(
      "POST",
      `/api/pools/${ID}/history/${rev}/revert`,
      cast[who].cookie,
      undefined,
      headers,
    ),
    params({ id: ID, rev }),
  );

describe("POST /api/pools/<id>/history/<rev>/revert", () => {
  it("wants a signed-in caller from this site", async () => {
    const cast = await createCast();
    await insertPool(cast, { _id: ID });
    const noCookie = await POST(
      poolRequest("POST", `/api/pools/${ID}/history/x/revert`, null),
      params({ id: ID, rev: "x" }),
    );
    expect(noCookie.status).toBe(401);
    const crossSite = await send(cast, "owner", "x", { origin: "https://evil.test" });
    expect(crossSite.status).toBe(403);
  });

  it("is 404 for someone else on a private pool", async () => {
    const cast = await createCast();
    await insertPool(cast, { _id: ID });
    expect((await send(cast, "other", "x")).status).toBe(404);
  });

  it("lets an editor revert to the root", async () => {
    const cast = await createCast();
    await insertPool(cast, { _id: ID });
    const inserted = await findBuiltPool(ID);
    if (!inserted) throw new Error("expected the pool");
    const root = await ensureHistory(inserted);
    const response = await send(cast, "editor", root.id);
    expect(response.status).toBe(200);
    const { pool } = (await response.json()) as { pool: { version: number } };
    expect(pool.version).toBe(1);
  });
});
