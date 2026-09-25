/**
 * @file tests/integration/app/api/admin.test.ts
 * @desc The admin routes: everyone but an admin gets the same 404 (a removed admin too); an admin
 *       request from another site or a sibling *.haruhime.moe host is refused; bodies must be
 *       JSON and valid; an edit saves and answers the sync outcome; badged and retries work; a
 *       refresh marks the home page, sitemap, llms.txt and every pool and map page stale.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { revalidatePath } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as postBadged } from "@/app/api/admin/badged/route";
import { PATCH } from "@/app/api/admin/pools/[id]/route";
import { POST as postRevalidate } from "@/app/api/admin/revalidate/route";
import { POST as postSync } from "@/app/api/admin/sync/route";
import { poolsCollection } from "@/models/Pool";
import { ADMIN_OSU_ID, createTestAdmin } from "../../../helpers/auth";
import { setupTestDb } from "../../../helpers/db";
import { makePool } from "../../../helpers/records";

setupTestDb();
beforeEach(() => {
  vi.stubEnv("ADMIN_OSU_IDS", String(ADMIN_OSU_ID));
  vi.stubEnv("POOLS_SERVICE_TOKEN", "");
});

const FORM = {
  tournament: "Spring Cup",
  round: "Finals",
  year: 2021,
  notes: "",
  hidden: false,
  badged: true,
};

const request = (
  path: string,
  method: string,
  cookie: string | null,
  body: unknown,
  headers: Record<string, string> = {},
) =>
  new Request(`http://localhost:3000${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
      ...headers,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

const context = (id: string) => ({ params: Promise.resolve({ id }) });

describe("PATCH /api/admin/pools/[id]", () => {
  it("is the same 404 for visitors and removed admins", async () => {
    await (await poolsCollection()).insertOne(makePool());
    expect(
      (await PATCH(request("/api/admin/pools/otdb-1", "PATCH", null, FORM), context("otdb-1")))
        .status,
    ).toBe(404);
    const admin = await createTestAdmin();
    vi.stubEnv("ADMIN_OSU_IDS", "1");
    expect(
      (
        await PATCH(
          request("/api/admin/pools/otdb-1", "PATCH", admin.cookie, FORM),
          context("otdb-1"),
        )
      ).status,
    ).toBe(404);
  });

  it.each([
    [{ origin: "https://evil.example" }],
    [{ origin: "https://packs.haruhime.moe" }],
    [{ "sec-fetch-site": "same-site" }],
  ])("refuses an admin request from %j", async (headers) => {
    await (await poolsCollection()).insertOne(makePool());
    const admin = await createTestAdmin();
    const response = await PATCH(
      request("/api/admin/pools/otdb-1", "PATCH", admin.cookie, FORM, headers),
      context("otdb-1"),
    );
    expect(response.status).toBe(403);
  });

  it("wants a JSON body that parses", async () => {
    await (await poolsCollection()).insertOne(makePool());
    const admin = await createTestAdmin();
    const text = await PATCH(
      request("/api/admin/pools/otdb-1", "PATCH", admin.cookie, JSON.stringify(FORM), {
        "content-type": "text/plain",
      }),
      context("otdb-1"),
    );
    expect(text.status).toBe(415);
    const bad = await PATCH(
      request("/api/admin/pools/otdb-1", "PATCH", admin.cookie, { ...FORM, year: 1999 }),
      context("otdb-1"),
    );
    expect(bad.status).toBe(400);
  });

  it("saves an edit and says what happened to the pack", async () => {
    await (await poolsCollection()).insertOne(makePool());
    const admin = await createTestAdmin();
    const response = await PATCH(
      request("/api/admin/pools/otdb-1", "PATCH", admin.cookie, FORM),
      context("otdb-1"),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = (await response.json()) as {
      pool: { year: number; badged: boolean };
      sync: { status: string };
    };
    expect(body.pool).toMatchObject({ year: 2021, badged: true });
    expect(body.sync).toEqual({
      status: "failed",
      message: "POOLS_SERVICE_TOKEN isn't set, so the pack wasn't updated.",
    });
    expect(
      (
        await PATCH(
          request("/api/admin/pools/otdb-9", "PATCH", admin.cookie, FORM),
          context("otdb-9"),
        )
      ).status,
    ).toBe(404);
  });
});

describe("POST /api/admin/badged and /api/admin/sync", () => {
  it("sets badged for a tournament and retries failed syncs, for admins only", async () => {
    await (await poolsCollection()).insertOne(makePool());
    const admin = await createTestAdmin();
    expect(
      (
        await postBadged(
          request("/api/admin/badged", "POST", null, {
            tournamentKey: "spring-cup",
            year: 2020,
            badged: true,
          }),
        )
      ).status,
    ).toBe(404);
    const badged = await postBadged(
      request("/api/admin/badged", "POST", admin.cookie, {
        tournamentKey: "spring-cup",
        year: 2020,
        badged: true,
      }),
    );
    expect(await badged.json()).toEqual({ matched: 1 });
    const sync = await postSync(
      request("/api/admin/sync", "POST", admin.cookie, { includeRejected: false }),
    );
    expect(await sync.json()).toMatchObject({
      due: 0,
      configError: "POOLS_SERVICE_TOKEN isn't set, so the pack wasn't updated.",
    });
    const crossSite = await postSync(
      request(
        "/api/admin/sync",
        "POST",
        admin.cookie,
        { includeRejected: false },
        { "sec-fetch-site": "cross-site" },
      ),
    );
    expect(crossSite.status).toBe(403);
  });
});

describe("POST /api/admin/revalidate", () => {
  it("marks every public page stale for an admin, and is the same 404 for everyone else", async () => {
    vi.mocked(revalidatePath).mockClear();
    expect((await postRevalidate(request("/api/admin/revalidate", "POST", null, {}))).status).toBe(
      404,
    );
    expect(revalidatePath).not.toHaveBeenCalled();
    const admin = await createTestAdmin();
    const crossSite = await postRevalidate(
      request(
        "/api/admin/revalidate",
        "POST",
        admin.cookie,
        {},
        { origin: "https://evil.example" },
      ),
    );
    expect(crossSite.status).toBe(403);
    const text = await postRevalidate(
      request("/api/admin/revalidate", "POST", admin.cookie, "{}", {
        "content-type": "text/plain",
      }),
    );
    expect(text.status).toBe(415);
    expect(revalidatePath).not.toHaveBeenCalled();
    const response = await postRevalidate(
      request("/api/admin/revalidate", "POST", admin.cookie, {}),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ ok: true });
    expect(vi.mocked(revalidatePath).mock.calls).toEqual(
      expect.arrayContaining([
        ["/"],
        ["/sitemap.xml"],
        ["/llms.txt"],
        ["/pools/[id]", "page"],
        ["/maps/[id]", "page"],
      ]),
    );
  });
});
