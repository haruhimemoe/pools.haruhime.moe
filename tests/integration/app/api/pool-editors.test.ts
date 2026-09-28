/**
 * @file tests/integration/app/api/pool-editors.test.ts
 * @desc Co-editors end to end, osu! stubbed with msw: the owner adds someone by osu! username
 *       before they ever signed in (stored by osu! id, no user id yet), and once they sign in
 *       their user id is filled in and they can open and edit the private pool; someone who
 *       already has an account gets their user id at once. Refused: a name osu! doesn't know,
 *       osu! down (503), the owner, a repeat, an 11th editor. The owner removes an editor, an
 *       editor removes themselves but nobody else; 30 editor changes an hour per user, counted
 *       (like the lookups' share of the osu! budget) by osu! id, so a new account can't reset it.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Mon Sep 28, 2026
 */

import { setupMsw } from "@haruhimemoe/next-kit/testing";
import { HttpResponse, http } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DELETE } from "@/app/api/pools/[id]/editors/[osuId]/route";
import { POST } from "@/app/api/pools/[id]/editors/route";
import { POST as postOps } from "@/app/api/pools/[id]/ops/route";
import { GET } from "@/app/api/pools/[id]/route";
import { RATE_LIMITS_COLLECTION } from "@/constants/db";
import { getDb } from "@/lib/db";
import { findBuiltPool } from "@/services/built-pool-read";
import { createTestUser } from "../../../helpers/auth";
import { setupTestDb } from "../../../helpers/db";
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
const server = setupMsw(
  ...osuUserHandlers({ newbie: 50, owner: 10, editor: EDITOR_OSU_ID, other: 40 }),
);
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const ID = "b-a0000001";
const at = params({ id: ID });

const add = (cookie: string, username: string) =>
  POST(poolRequest("POST", `/api/pools/${ID}/editors`, cookie, { username }), at);

const remove = (cookie: string, osuId: number | string) =>
  DELETE(
    poolRequest("DELETE", `/api/pools/${ID}/editors/${osuId}`, cookie),
    params({ id: ID, osuId: String(osuId) }),
  );

const codeOf = async (response: Response) =>
  ((await response.json()) as { error: { code: string } }).error.code;

describe("adding an editor", () => {
  it("adds someone who never signed in; they get access once they do", async () => {
    const cast = await createCast();
    await insertPool(cast, { _id: ID });
    const response = await add(cast.owner.cookie, "Newbie");
    expect(response.status).toBe(200);
    const { pool } = (await response.json()) as { pool: { version: number; editors: unknown[] } };
    expect(pool.version).toBe(2);
    expect(pool.editors).toContainEqual(expect.objectContaining({ osuId: 50, username: "Newbie" }));
    expect((await findBuiltPool(ID))?.editors.find((e) => e.osuId === 50)?.userId).toBeNull();
    const newbie = await createTestUser(50, "newbie");
    expect((await findBuiltPool(ID))?.editors.find((e) => e.osuId === 50)?.userId).toBe(newbie.id);
    expect((await GET(poolRequest("GET", `/api/pools/${ID}`, newbie.cookie), at)).status).toBe(200);
    const ops = { baseVersion: 2, ops: [{ type: "addMap", beatmapId: 9, bucket: "NM" }] };
    const edit = await postOps(poolRequest("POST", `/api/pools/${ID}/ops`, newbie.cookie, ops), at);
    expect(edit.status).toBe(200);
  });

  it("links someone who already signed in at once", async () => {
    const cast = await createCast();
    await insertPool(cast, { _id: ID, editors: [] });
    expect((await add(cast.owner.cookie, "other")).status).toBe(200);
    expect((await findBuiltPool(ID))?.editors).toEqual([
      expect.objectContaining({ osuId: 40, userId: cast.other.id }),
    ]);
  });

  it.each([
    ["a name osu! doesn't know", "nobody", 400, "unknown_user"],
    ["the owner", "owner", 400, "is_owner"],
    ["someone already editing", "editor", 400, "already_editor"],
  ])("refuses %s", async (_case, username, status, code) => {
    const cast = await createCast();
    await insertPool(cast, { _id: ID });
    const response = await add(cast.owner.cookie, username);
    expect(response.status).toBe(status);
    expect(await codeOf(response)).toBe(code);
  });
});

describe("editor limits", () => {
  it("answers 503 when osu! can't be asked", async () => {
    const cast = await createCast();
    await insertPool(cast, { _id: ID });
    server.use(http.get("https://osu.ppy.sh/api/v2/users/:user", () => HttpResponse.error()));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await add(cast.owner.cookie, "newbie");
    expect(response.status).toBe(503);
    expect(await codeOf(response)).toBe("osu_unavailable");
  });

  it("stops at 10 editors", async () => {
    const cast = await createCast();
    const editors = Array.from({ length: 10 }, (_, i) => ({
      userId: null,
      osuId: 100 + i,
      username: `e${i}`,
      addedAt: new Date(),
    }));
    await insertPool(cast, { _id: ID, editors });
    expect(await codeOf(await add(cast.owner.cookie, "newbie"))).toBe("too_many_editors");
  });

  it("allows 30 editor changes an hour per user", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(`${new Date().toISOString().slice(0, 13)}:00:01.000Z`));
    const cast = await createCast();
    await insertPool(cast, { _id: ID, editors: [] });
    for (let i = 0; i < 15; i++) {
      expect((await add(cast.owner.cookie, "newbie")).status).toBe(200);
      expect((await remove(cast.owner.cookie, 50)).status).toBe(204);
    }
    expect((await add(cast.owner.cookie, "newbie")).status).toBe(429);
  });

  it("counts the limit and the lookups' osu! budget by the owner's osu! id", async () => {
    const cast = await createCast();
    await insertPool(cast, { _id: ID, editors: [] });
    expect((await add(cast.owner.cookie, "newbie")).status).toBe(200);
    const ids = (
      await getDb().collection<{ _id: string }>(RATE_LIMITS_COLLECTION).find().toArray()
    ).map((counter) => counter._id);
    expect(ids.filter((id) => id.includes(":osu:10:"))).toHaveLength(2);
    expect(ids.some((id) => id.includes(cast.owner.id))).toBe(false);
  });
});

describe("removing an editor", () => {
  const cast2 = async (): Promise<Cast> => {
    const cast = await createCast();
    await insertPool(cast, {
      _id: ID,
      editors: [
        { userId: cast.editor.id, osuId: EDITOR_OSU_ID, username: "editor", addedAt: new Date() },
        { userId: null, osuId: 50, username: "newbie", addedAt: new Date() },
      ],
    });
    return cast;
  };

  it("lets the owner remove anyone, and an editor only themselves", async () => {
    const cast = await cast2();
    expect((await remove(cast.editor.cookie, 50)).status).toBe(403);
    expect((await remove(cast.owner.cookie, 50)).status).toBe(204);
    expect((await remove(cast.editor.cookie, EDITOR_OSU_ID)).status).toBe(204);
    const stored = await findBuiltPool(ID);
    expect(stored?.editors).toEqual([]);
    expect(stored?.version).toBe(3);
    const gone = await GET(poolRequest("GET", `/api/pools/${ID}`, cast.editor.cookie), at);
    expect(gone.status).toBe(404);
  });

  it("answers 404 for someone who doesn't edit it, or an osu! id that isn't one", async () => {
    const cast = await cast2();
    expect(await codeOf(await remove(cast.owner.cookie, 77))).toBe("not_editor");
    expect((await remove(cast.owner.cookie, "abc")).status).toBe(404);
  });
});
