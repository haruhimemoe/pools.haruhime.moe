/**
 * @file tests/integration/app/api/internal-pool.test.ts
 * @desc /api/internal/pools/[id]: tourney.haruhime.moe reading a pool by id. 503 while
 *       TOURNEY_SERVICE_SECRET is unset, 401 without it, 404 for a missing pool, and any
 *       visibility (private, hidden) read as a visitor would see a public pool: slots, no
 *       candidates or editor-only fields. Never cached.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Oct 8, 2026
 * @modified Thu Oct 8, 2026
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/internal/pools/[id]/route";
import { setupTestDb } from "../../../helpers/db";
import { createCast, insertPool, params } from "../../../helpers/pool-requests";

setupTestDb();
afterEach(() => vi.unstubAllEnvs());

const SECRET = "t".repeat(40);
const ID = "b-a0000001";

const call = (id: string, secret: string | null = SECRET) =>
  GET(
    new Request(`http://localhost/api/internal/pools/${id}`, {
      headers: secret ? { Authorization: `Bearer ${secret}` } : {},
    }),
    params({ id }),
  );

describe("/api/internal/pools/[id]", () => {
  it("refuses every call while the secret is unset", async () => {
    vi.stubEnv("TOURNEY_SERVICE_SECRET", "");
    const response = await call(ID);
    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("needs the bearer secret", async () => {
    vi.stubEnv("TOURNEY_SERVICE_SECRET", SECRET);
    expect((await call(ID, null)).status).toBe(401);
    expect((await call(ID, "x".repeat(40))).status).toBe(401);
  });

  it("answers 404 for a pool that isn't there", async () => {
    vi.stubEnv("TOURNEY_SERVICE_SECRET", SECRET);
    expect((await call("b-ffffffff")).status).toBe(404);
  });

  it.each([
    { visibility: "private" as const, hidden: false },
    { visibility: "public" as const, hidden: true },
  ])("reads a $visibility pool (hidden: $hidden) without editor fields", async (overrides) => {
    vi.stubEnv("TOURNEY_SERVICE_SECRET", SECRET);
    const cast = await createCast();
    const pool = await insertPool(cast, { _id: ID, ...overrides });
    const response = await call(ID);
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const body = await response.json();
    expect(body.pool).toMatchObject({ id: ID, name: pool.name, slots: pool.slots });
    expect(body.pool.candidates).toBeUndefined();
    expect(body.pool.head).toBeUndefined();
    expect(body.pool.access).toMatchObject({ canEdit: false, canManage: false });
  });
});
