/**
 * @file tests/integration/app/api/admin-pools.test.ts
 * @desc POST /api/admin/pools, adding a host or community pool: the same 404 for visitors and
 *       removed admins (nothing written), other sites and sibling *.haruhime.moe hosts refused,
 *       JSON only, per-field errors for what the form got wrong (a credit name of 101
 *       characters, an http link, no tournament, maps that can't be read), 201 with the new
 *       pool's id and admin link, 200 naming the pool it joined. Never cached. The mirror is a
 *       stand-in (msw); no packs token is set, so the answer says the pack wasn't sent.
 * @author David @dvhsh (https://dvh.sh)
 * @created Fri Sep 25, 2026
 * @modified Fri Sep 25, 2026
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/admin/pools/route";
import { poolsCollection } from "@/models/Pool";
import { ADMIN_OSU_ID, createTestAdmin } from "../../../helpers/auth";
import { setupTestDb } from "../../../helpers/db";
import { mirrorHandler } from "../../../helpers/hinai-server";
import { setupMsw } from "../../../helpers/msw";
import { makePool } from "../../../helpers/records";

setupTestDb();
setupMsw(mirrorHandler(new Map()));
beforeEach(() => {
  vi.stubEnv("ADMIN_OSU_IDS", String(ADMIN_OSU_ID));
  vi.stubEnv("POOLS_SERVICE_TOKEN", "");
});

const FORM = {
  kind: "host",
  creditName: "Spring Cup hosts",
  creditUrl: "",
  tournament: "Spring Cup",
  round: "Finals",
  year: 2026,
  badged: null,
  notes: "",
  maps: "NM1 129891\nHD1 75",
};

const post = (cookie: string | null, body: unknown, headers: Record<string, string> = {}) =>
  POST(
    new Request("http://localhost:3000/api/admin/pools", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(cookie ? { cookie } : {}),
        ...headers,
      },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );

type Answer = {
  outcome?: string;
  pool?: { id: string; name: string; href: string };
  sync?: { status: string };
  error?: { code: string; message: string; fields?: Record<string, string> };
};

describe("POST /api/admin/pools", () => {
  it("is the same 404 for visitors and removed admins, and writes nothing", async () => {
    expect((await post(null, FORM)).status).toBe(404);
    const admin = await createTestAdmin();
    vi.stubEnv("ADMIN_OSU_IDS", "1");
    expect((await post(admin.cookie, FORM)).status).toBe(404);
    expect(await (await poolsCollection()).countDocuments()).toBe(0);
  });

  it.each([
    [{ origin: "https://evil.example" }],
    [{ origin: "https://packs.haruhime.moe" }],
    [{ "sec-fetch-site": "same-site" }],
  ])("refuses an admin request from %j", async (headers) => {
    const admin = await createTestAdmin();
    expect((await post(admin.cookie, FORM, headers)).status).toBe(403);
    expect(await (await poolsCollection()).countDocuments()).toBe(0);
  });

  it("wants JSON", async () => {
    const admin = await createTestAdmin();
    const response = await post(admin.cookie, JSON.stringify(FORM), {
      "content-type": "text/plain",
    });
    expect(response.status).toBe(415);
  });

  it("answers an error for each field the form got wrong", async () => {
    const admin = await createTestAdmin();
    const response = await post(admin.cookie, {
      ...FORM,
      creditName: "a".repeat(101),
      creditUrl: "http://example.com/sheet",
      tournament: "  ",
    });
    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = (await response.json()) as Answer;
    expect(body.error?.code).toBe("bad_request");
    expect(body.error?.fields).toEqual({
      creditName: "Keep the name to 100 characters.",
      creditUrl: "Use an https link, or leave it empty.",
      tournament: "The tournament needs a name.",
    });
    expect(body.error?.message).toBe("Keep the name to 100 characters.");
  });

  it("answers a maps error the service finds", async () => {
    const admin = await createTestAdmin();
    const response = await post(admin.cookie, { ...FORM, maps: "https://packs.haruhime.moe/p/x" });
    expect(response.status).toBe(400);
    const body = (await response.json()) as Answer;
    expect(body.error?.fields?.maps).toMatch(/\/k link/);
  });

  it("creates a pool and answers where it is", async () => {
    const admin = await createTestAdmin();
    const response = await post(admin.cookie, FORM);
    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = (await response.json()) as Answer;
    expect(body).toMatchObject({
      outcome: "created",
      pool: { name: "Spring Cup 2026 Finals" },
      sync: { status: "failed" },
    });
    expect(body.pool?.href).toBe(`/admin/pools/${body.pool?.id}`);
    expect(await (await poolsCollection()).countDocuments()).toBe(1);
  });

  it("names the pool the maps joined", async () => {
    await (await poolsCollection()).insertOne(
      makePool({
        _id: "otdb-657",
        name: "osu! World Cup 2023 Grand Finals",
        slots: [
          { mod: "NM", index: 1, beatmapId: 129891 },
          { mod: "HD", index: 1, beatmapId: 75 },
        ],
      }),
    );
    const admin = await createTestAdmin();
    const response = await post(admin.cookie, FORM);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      outcome: "merged",
      pool: {
        id: "otdb-657",
        name: "osu! World Cup 2023 Grand Finals",
        href: "/admin/pools/otdb-657",
      },
    });
  });
});
