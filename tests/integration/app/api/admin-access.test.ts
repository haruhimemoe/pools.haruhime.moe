/**
 * @file tests/integration/app/api/admin-access.test.ts
 * @desc Who gets past each admin route now that every osu! user can sign in: a visitor and a
 *       signed-in user who isn't an admin get the same 404 as an unknown route; an admin gets
 *       through to the body check (415 for a body that isn't JSON), so nothing runs.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as postBadged } from "@/app/api/admin/badged/route";
import { POST as postPackCleanup } from "@/app/api/admin/pack-cleanup/route";
import { PATCH as patchPool } from "@/app/api/admin/pools/[id]/route";
import { POST as postPool } from "@/app/api/admin/pools/route";
import { POST as postRevalidate } from "@/app/api/admin/revalidate/route";
import { POST as postSync } from "@/app/api/admin/sync/route";
import { ADMIN_OSU_ID, createTestAdmin, createTestUser } from "../../../helpers/auth";
import { setupTestDb } from "../../../helpers/db";

setupTestDb();
beforeEach(() => {
  vi.stubEnv("ADMIN_OSU_IDS", String(ADMIN_OSU_ID));
});

const context = { params: Promise.resolve({ id: "otdb-1" }) };

const ROUTES: [string, (request: Request) => Promise<Response>][] = [
  ["POST /api/admin/badged", postBadged],
  ["POST /api/admin/pack-cleanup", postPackCleanup],
  ["POST /api/admin/pools", postPool],
  ["PATCH /api/admin/pools/otdb-1", (request) => patchPool(request, context)],
  ["POST /api/admin/revalidate", postRevalidate],
  ["POST /api/admin/sync", postSync],
];

const request = (cookie: string | null) =>
  new Request("http://localhost:3000/api/admin/x", {
    method: "POST",
    headers: { "content-type": "text/plain", ...(cookie ? { cookie } : {}) },
    body: "hello",
  });

describe("admin routes", () => {
  it.each(ROUTES)("%s: 404 for a visitor and a signed-in user", async (_route, handler) => {
    expect((await handler(request(null))).status).toBe(404);
    const user = await createTestUser(2);
    expect((await handler(request(user.cookie))).status).toBe(404);
  });

  it.each(ROUTES)("%s: an admin gets through to the body check", async (_route, handler) => {
    const admin = await createTestAdmin();
    expect((await handler(request(admin.cookie))).status).toBe(415);
  });
});
