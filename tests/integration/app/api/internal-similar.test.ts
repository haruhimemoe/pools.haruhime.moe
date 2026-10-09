/**
 * @file tests/integration/app/api/internal-similar.test.ts
 * @desc /api/internal/similar/[id]: harumin's /practice asking for maps like a top play. 503
 *       while HARUMIN_SERVICE_SECRET is unset, 401 without it, 400 for a bad id, and the same
 *       body as the public route, never cached and outside the per-IP limit.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Oct 8, 2026
 * @modified Thu Oct 8, 2026
 */

import { setupMsw } from "@haruhimemoe/next-kit/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/internal/similar/[id]/route";
import { BROWSE_LENSES } from "@/constants/browse";
import { resetLensList } from "@/lib/browse-lenses";
import { resetMirrorCooldown } from "@/lib/map-search";
import type { SimilarResponse } from "@/utils/similar-params";
import { setupTestDb } from "../../../helpers/db";
import { lensStats, lensStatsHandler, nekohaAnswer, nekohaHandler } from "../../../helpers/nekoha";
import { params } from "../../../helpers/pool-requests";
import { ppBatchHandler, ppValues } from "../../../helpers/pp-batch";
import { beatmapRow, beatmapsHandler, rowsOf, seedSimilar } from "../../../helpers/similar";

setupTestDb();
const server = setupMsw();
beforeEach(() => {
  vi.unstubAllEnvs();
  resetMirrorCooldown();
  resetLensList();
  server.use(
    lensStatsHandler(() => lensStats([...BROWSE_LENSES])),
    ppBatchHandler(() => ppValues({ stars: 6.1 })),
    beatmapsHandler(rowsOf([beatmapRow(1, 100), beatmapRow(11, 110), beatmapRow(21, 120)])),
    nekohaHandler(() => nekohaAnswer([], { mod: "NM", total: 0 })),
  );
});

const SECRET = "h".repeat(40);

const call = (id: string, query = "", secret: string | null = SECRET) =>
  GET(
    new Request(`http://localhost/api/internal/similar/${id}${query ? `?${query}` : ""}`, {
      headers: {
        "x-real-ip": "203.0.113.9",
        ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
      },
    }),
    params({ id }),
  );

describe("/api/internal/similar/[id]", () => {
  it("refuses every call while the secret is unset", async () => {
    vi.stubEnv("HARUMIN_SERVICE_SECRET", "");
    const response = await call("1");
    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("needs the bearer secret", async () => {
    vi.stubEnv("HARUMIN_SERVICE_SECRET", SECRET);
    expect((await call("1", "", null)).status).toBe(401);
    expect((await call("1", "", "x".repeat(40))).status).toBe(401);
  });

  it("answers 400 for a bad id", async () => {
    vi.stubEnv("HARUMIN_SERVICE_SECRET", SECRET);
    expect((await call("abc")).status).toBe(400);
  });

  it("answers the public route's body, never cached", async () => {
    vi.stubEnv("HARUMIN_SERVICE_SECRET", SECRET);
    await seedSimilar(1, [
      { id: 21, score: 255 },
      { id: 11, score: 204 },
    ]);
    const response = await call("1", "mods=DT");
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const answer = (await response.json()) as SimilarResponse;
    expect(answer).toMatchObject({ id: 1, method: "pattern", lens: "DT" });
    expect(answer.sets.flatMap((set) => set.diffs.map((d) => d.id))).toEqual([21, 11]);
  });

  it("isn't held to the per-IP limit", async () => {
    vi.stubEnv("HARUMIN_SERVICE_SECRET", SECRET);
    for (let i = 0; i < 65; i++) expect((await call("abc")).status).toBe(400);
  });
});
