/**
 * @file tests/integration/app/api/pool-owner.test.ts
 * @desc POST /api/pools/<id>/owner: the owner hands the pool to an editor who has signed in and
 *       owns fewer than 50 pools, typing the pool's name exactly. The old owner stays on as an
 *       editor (and loses the owner's rights), the version goes up, and a shared pool's pack is
 *       marked pending so its credit line follows. Refused: a name that isn't exactly the pool's,
 *       someone who doesn't edit it, an editor who hasn't signed in, an editor at the cap,
 *       another site, a body with more than it takes, and more editor changes than the hour
 *       allows. Only the owner is told which editors have signed in. The permissions matrix is in
 *       pool-permissions.test.ts.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Mon Sep 28, 2026
 */

import { userSubject } from "@haruhimemoe/next-kit/server";
import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/pools/[id]/owner/route";
import { GET } from "@/app/api/pools/[id]/route";
import { PUT as putVisibility } from "@/app/api/pools/[id]/visibility/route";
import { RATE_LIMITS } from "@/constants/api";
import { refuseOverLimit } from "@/lib/rate-limit";
import { builtPoolsCollection } from "@/models/BuiltPool";
import { findBuiltPool } from "@/services/built-pool-read";
import { afterTaskCount } from "../../../helpers/after";
import { makeBuiltPool } from "../../../helpers/built-pools";
import { setupTestDb } from "../../../helpers/db";
import {
  createCast,
  EDITOR_OSU_ID,
  insertPool,
  params,
  poolRequest,
} from "../../../helpers/pool-requests";

setupTestDb();

const ID = "b-a0000001";
const NAME = "Spring Cup Finals";
const at = params({ id: ID });

const handOver = (
  cookie: string,
  body: unknown = { osuId: EDITOR_OSU_ID, confirmName: NAME },
  headers: Record<string, string> = {},
) => POST(poolRequest("POST", `/api/pools/${ID}/owner`, cookie, body, headers), at);

const codeOf = async (response: Response) =>
  ((await response.json()) as { error: { code: string } }).error.code;

describe("handing a pool to an editor", () => {
  it("makes the editor the owner, and the old owner an editor without the owner's rights", async () => {
    const cast = await createCast();
    await insertPool(cast, { _id: ID });
    const response = await handOver(cast.owner.cookie);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const { pool } = (await response.json()) as {
      pool: { version: number; owner: unknown; editors: unknown[]; access: unknown };
    };
    expect(pool.version).toBe(2);
    expect(pool.owner).toEqual({ osuId: EDITOR_OSU_ID, username: "editor" });
    expect(pool.editors).toEqual([expect.objectContaining({ osuId: 10, username: "owner" })]);
    expect(pool.access).toMatchObject({ isOwner: false, isEditor: true, canManage: false });
    const stored = await findBuiltPool(ID);
    expect(stored?.ownerId).toBe(cast.editor.id);
    expect(stored?.editors).toEqual([
      expect.objectContaining({ userId: cast.owner.id, osuId: 10 }),
    ]);
    const visibility = (cookie: string) =>
      putVisibility(
        poolRequest("PUT", `/api/pools/${ID}/visibility`, cookie, { visibility: "unlisted" }),
        at,
      );
    expect((await visibility(cast.owner.cookie)).status).toBe(403);
    expect((await visibility(cast.editor.cookie)).status).toBe(200);
  });

  it("marks a shared pool's pack pending, so its credit line follows", async () => {
    const cast = await createCast();
    const pack = { ...makeBuiltPool().pack, state: "synced" as const, slug: "spring-cup" };
    const slots = [{ mod: "NM", index: 1, beatmapId: 5 }];
    await insertPool(cast, { _id: ID, visibility: "public", slots, pack });
    expect((await handOver(cast.owner.cookie)).status).toBe(200);
    expect((await findBuiltPool(ID))?.pack.state).toBe("pending");
    expect(afterTaskCount()).toBe(1);
  });

  it("refuses a name that isn't exactly the pool's", async () => {
    const cast = await createCast();
    await insertPool(cast, { _id: ID });
    for (const confirmName of ["spring cup finals", ` ${NAME}`, "Spring Cup"]) {
      const response = await handOver(cast.owner.cookie, { osuId: EDITOR_OSU_ID, confirmName });
      expect(response.status).toBe(400);
      expect(await codeOf(response)).toBe("wrong_name");
    }
    expect((await findBuiltPool(ID))?.ownerId).toBe(cast.owner.id);
  });

  it("refuses someone who doesn't edit it, and an editor who hasn't signed in", async () => {
    const cast = await createCast();
    const newbie = { userId: null, osuId: 50, username: "newbie", addedAt: new Date() };
    await insertPool(cast, { _id: ID, editors: [newbie] });
    const stranger = await handOver(cast.owner.cookie, { osuId: 40, confirmName: NAME });
    expect(await codeOf(stranger)).toBe("not_editor");
    const notYet = await handOver(cast.owner.cookie, { osuId: 50, confirmName: NAME });
    expect(notYet.status).toBe(400);
    expect(await codeOf(notYet)).toBe("not_signed_in");
    expect((await findBuiltPool(ID))?.version).toBe(1);
  });

  it("refuses an editor who already owns 50 pools", async () => {
    const cast = await createCast();
    await insertPool(cast, { _id: ID });
    const theirs = Array.from({ length: 50 }, (_, i) =>
      makeBuiltPool({ _id: `b-e${String(i).padStart(7, "0")}`, ownerId: cast.editor.id }),
    );
    await (await builtPoolsCollection()).insertMany(theirs);
    const response = await handOver(cast.owner.cookie);
    expect(response.status).toBe(400);
    expect(await codeOf(response)).toBe("too_many_pools");
    expect((await findBuiltPool(ID))?.ownerId).toBe(cast.owner.id);
  });

  it("tells only the owner which editors have signed in", async () => {
    const cast = await createCast();
    const newbie = { userId: null, osuId: 50, username: "newbie", addedAt: new Date() };
    await insertPool(cast, { _id: ID });
    await (await builtPoolsCollection()).updateOne({ _id: ID }, { $push: { editors: newbie } });
    const editorsFor = async (cookie: string) =>
      (
        (await (await GET(poolRequest("GET", `/api/pools/${ID}`, cookie), at)).json()) as {
          pool: { editors: Record<string, unknown>[] };
        }
      ).pool.editors;
    expect(await editorsFor(cast.owner.cookie)).toEqual([
      expect.objectContaining({ osuId: EDITOR_OSU_ID, signedIn: true }),
      expect.objectContaining({ osuId: 50, signedIn: false }),
    ]);
    for (const editor of await editorsFor(cast.editor.cookie)) {
      expect(editor).not.toHaveProperty("signedIn");
    }
  });

  it("refuses another site and a body with more than it takes", async () => {
    const cast = await createCast();
    await insertPool(cast, { _id: ID });
    const crossSite = await handOver(cast.owner.cookie, undefined, {
      origin: "https://evil.test",
    });
    expect(crossSite.status).toBe(403);
    const extra = { osuId: EDITOR_OSU_ID, confirmName: NAME, ownerId: cast.other.id };
    expect((await handOver(cast.owner.cookie, extra)).status).toBe(400);
    expect((await findBuiltPool(ID))?.ownerId).toBe(cast.owner.id);
  });

  it("counts against the editor-change limit", async () => {
    const cast = await createCast();
    await insertPool(cast, { _id: ID });
    const { poolEditors } = RATE_LIMITS;
    await refuseOverLimit(poolEditors, userSubject({ osuId: 10 }), poolEditors.limit);
    expect((await handOver(cast.owner.cookie)).status).toBe(429);
    expect((await findBuiltPool(ID))?.ownerId).toBe(cast.owner.id);
  });
});
