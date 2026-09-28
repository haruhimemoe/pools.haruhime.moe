/**
 * @file tests/integration/app/api/pool-permissions.test.ts
 * @desc Every pool route for the owner, an editor, an admin, someone else and a visitor, over a
 *       private, an unlisted and a public pool, and a hidden unlisted and hidden public one. Can't
 *       see it: 404. Signed out on a write:
 *       401. Sees it but may not: 403. The owner does everything; editors read and edit, and
 *       remove themselves; admins see what isn't private and delete any pool, but never edit.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE as deleteEditor } from "@/app/api/pools/[id]/editors/[osuId]/route";
import { POST as postEditor } from "@/app/api/pools/[id]/editors/route";
import { POST as postOps } from "@/app/api/pools/[id]/ops/route";
import { DELETE as deletePool, GET as getPool } from "@/app/api/pools/[id]/route";
import { GET as getValues } from "@/app/api/pools/[id]/values/route";
import { PUT as putVisibility } from "@/app/api/pools/[id]/visibility/route";
import type { Visibility } from "@/constants/built-pools";
import { ADMIN_OSU_ID } from "../../../helpers/auth";
import { setupTestDb } from "../../../helpers/db";
import { setupMsw } from "../../../helpers/msw";
import {
  type Cast,
  createCast,
  EDITOR_OSU_ID,
  insertPool,
  osuUserHandlers,
  params,
  poolRequest,
} from "../../../helpers/pool-requests";

setupTestDb();
setupMsw(...osuUserHandlers({ newbie: 50 }));
beforeEach(() => {
  vi.stubEnv("ADMIN_OSU_IDS", String(ADMIN_OSU_ID));
});

const ID = "b-a0000001";
const base = `/api/pools/${ID}`;
const at = params({ id: ID });

type Who = keyof Cast | "visitor";
type Call = (cookie: string | null) => Promise<Response>;

const ROUTES: Record<string, Call> = {
  get: (cookie) => getPool(poolRequest("GET", base, cookie), at),
  ops: (cookie) =>
    postOps(
      poolRequest("POST", `${base}/ops`, cookie, {
        baseVersion: 1,
        ops: [{ type: "addMap", beatmapId: 5, bucket: "NM" }],
      }),
      at,
    ),
  visibility: (cookie) =>
    putVisibility(poolRequest("PUT", `${base}/visibility`, cookie, { visibility: "unlisted" }), at),
  delete: (cookie) => deletePool(poolRequest("DELETE", base, cookie), at),
  values: (cookie) => getValues(poolRequest("GET", `${base}/values`, cookie), at),
  addEditor: (cookie) =>
    postEditor(poolRequest("POST", `${base}/editors`, cookie, { username: "newbie" }), at),
  removeEditor: (cookie) =>
    deleteEditor(
      poolRequest("DELETE", `${base}/editors/${EDITOR_OSU_ID}`, cookie),
      params({ id: ID, osuId: String(EDITOR_OSU_ID) }),
    ),
};

/** Expected statuses, owner / editor / admin / other / visitor. */
const MATRIX: [Visibility, boolean, string, number[]][] = [
  ["private", false, "get", [200, 200, 404, 404, 404]],
  ["private", false, "ops", [200, 200, 404, 404, 401]],
  ["private", false, "visibility", [200, 403, 404, 404, 401]],
  ["private", false, "delete", [204, 403, 204, 404, 401]],
  ["private", false, "addEditor", [200, 403, 404, 404, 401]],
  ["private", false, "removeEditor", [204, 204, 404, 404, 401]],
  ["private", false, "values", [200, 200, 404, 404, 401]],
  ["public", false, "values", [200, 200, 403, 403, 401]],
  ["unlisted", false, "values", [200, 200, 403, 403, 401]],
  ["public", true, "values", [200, 200, 403, 404, 401]],
  ["unlisted", true, "values", [200, 200, 403, 404, 401]],
  ["public", false, "get", [200, 200, 200, 200, 200]],
  ["public", false, "ops", [200, 200, 403, 403, 401]],
  ["public", false, "visibility", [200, 403, 403, 403, 401]],
  ["public", false, "delete", [204, 403, 204, 403, 401]],
  ["public", false, "addEditor", [200, 403, 403, 403, 401]],
  ["public", false, "removeEditor", [204, 204, 403, 403, 401]],
  ["unlisted", false, "get", [200, 200, 200, 200, 200]],
  ["unlisted", false, "ops", [200, 200, 403, 403, 401]],
  ["unlisted", false, "visibility", [200, 403, 403, 403, 401]],
  ["unlisted", false, "delete", [204, 403, 204, 403, 401]],
  ["unlisted", false, "addEditor", [200, 403, 403, 403, 401]],
  ["unlisted", false, "removeEditor", [204, 204, 403, 403, 401]],
  ["public", true, "get", [200, 200, 200, 404, 404]],
  ["public", true, "ops", [200, 200, 403, 404, 401]],
  ["public", true, "visibility", [200, 403, 403, 404, 401]],
  ["public", true, "delete", [204, 403, 204, 404, 401]],
  ["public", true, "addEditor", [200, 403, 403, 404, 401]],
  ["public", true, "removeEditor", [204, 204, 403, 404, 401]],
  ["unlisted", true, "get", [200, 200, 200, 404, 404]],
  ["unlisted", true, "ops", [200, 200, 403, 404, 401]],
  ["unlisted", true, "visibility", [200, 403, 403, 404, 401]],
  ["unlisted", true, "delete", [204, 403, 204, 404, 401]],
  ["unlisted", true, "addEditor", [200, 403, 403, 404, 401]],
  ["unlisted", true, "removeEditor", [204, 204, 403, 404, 401]],
];

const WHO: Who[] = ["owner", "editor", "admin", "other", "visitor"];

const CASES = MATRIX.flatMap(([visibility, hidden, route, statuses]) =>
  WHO.map((who, i) => [visibility, hidden, route, who, statuses[i] as number] as const),
);

describe("pool route permissions", () => {
  it.each(CASES)("%s (hidden %s) %s as %s: %i", async (visibility, hidden, route, who, status) => {
    const cast = await createCast();
    await insertPool(cast, { _id: ID, visibility, hidden });
    const cookie = who === "visitor" ? null : cast[who].cookie;
    const call = ROUTES[route];
    if (!call) throw new Error(route);
    const response = await call(cookie);
    expect(response.status).toBe(status);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("answers 404 for a pool that isn't there, to everyone", async () => {
    const cast = await createCast();
    for (const call of Object.values(ROUTES)) {
      expect((await call(cast.owner.cookie)).status).toBe(404);
    }
  });
});
