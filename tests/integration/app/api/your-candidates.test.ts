/**
 * @file tests/integration/app/api/your-candidates.test.ts
 * @desc GET /api/candidates over a real (in-memory) database, the mirror stood in by msw: the
 *       candidates from pools the caller owns or edits (never anyone else's), newest first with
 *       their pool, slot and note, picks only when asked, filtered by bucket and text, with stars
 *       under the current bucket's mods; a deleted pool's are gone; signed out 401, no pool 400,
 *       a pool the caller can't edit 403 or 404; never cached.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { setupMsw } from "@haruhimemoe/next-kit/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/candidates/route";
import { resetMirrorCooldown } from "@/lib/map-search";
import { builtPoolsCollection } from "@/models/BuiltPool";
import { mapsCollection } from "@/models/Map";
import type { YourCandidatesAnswer } from "@/schemas/your-candidates";
import { ADMIN_OSU_ID } from "../../../helpers/auth";
import { candidate } from "../../../helpers/candidates";
import { setupTestDb } from "../../../helpers/db";
import { type Cast, createCast, insertPool, poolRequest } from "../../../helpers/pool-requests";
import { ppBatchHandler, ppValues } from "../../../helpers/pp-batch";
import { makeMap } from "../../../helpers/records";

setupTestDb();
const server = setupMsw();
beforeEach(() => {
  resetMirrorCooldown();
  vi.stubEnv("ADMIN_OSU_IDS", String(ADMIN_OSU_ID));
});

const EDITING = "b-a0000001";
const OTHER = "b-a0000002";
const STRANGER = "b-a0000003";

const setup = async () => {
  const cast = await createCast();
  await insertPool(cast, {
    _id: EDITING,
    name: "Autumn Cup",
    slots: [{ mod: "NM", index: 1, beatmapId: 1 }],
    candidates: {
      "NM:1": [candidate(2, { note: "tech check", addedAt: "2026-09-27T10:00:00.000Z" })],
      "HR:1": [candidate(3, { votes: [10], addedAt: "2026-09-28T09:00:00.000Z" })],
    },
  });
  await insertPool(cast, {
    _id: OTHER,
    name: "Winter Cup",
    candidates: { "DT:2": [candidate(4, { addedAt: "2026-09-26T10:00:00.000Z" })] },
  });
  // A pool the owner neither owns nor edits.
  await (await builtPoolsCollection()).insertOne({
    ...(await (await builtPoolsCollection()).findOne({ _id: OTHER })),
    _id: STRANGER,
    ownerId: cast.other.id,
    editors: [],
    candidates: { "NM:1": [candidate(5)] },
  } as never);
  await (await mapsCollection()).insertMany(
    [1, 2, 3, 4, 5].map((id) => makeMap({ _id: id, title: id === 3 ? "Freedom Dive" : "Song" })),
  );
  return cast;
};

const ask = async (cast: Cast, query: string, who: keyof Cast = "owner") => {
  const response = await GET(poolRequest("GET", `/api/candidates?${query}`, cast[who].cookie));
  return { response, body: (await response.json()) as YourCandidatesAnswer };
};

describe("GET /api/candidates", () => {
  it("lists the caller's candidates newest first, never someone else's, never cached", async () => {
    const cast = await setup();
    const { response, body } = await ask(cast, `pool=${EDITING}`);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body.rows.map((row) => [row.poolName, row.bucket, row.index, row.beatmapId])).toEqual([
      ["Autumn Cup", "HR", 1, 3],
      ["Autumn Cup", "NM", 1, 2],
      ["Winter Cup", "DT", 2, 4],
    ]);
    expect(body.rows[1]).toMatchObject({ kind: "candidate", note: "tech check" });
    expect(JSON.stringify(body)).not.toMatch(/"votes"/);
    const editor = await ask(cast, `pool=${EDITING}`, "editor");
    expect(editor.body.total).toBe(3);
  });

  it("adds picks when asked, and filters by bucket and text", async () => {
    const cast = await setup();
    const picks = await ask(cast, `pool=${EDITING}&picks=1`);
    expect(picks.body.rows.find((row) => row.kind === "pick")?.beatmapId).toBe(1);
    expect(
      (await ask(cast, `pool=${EDITING}&bucket=DT`)).body.rows.map((r) => r.beatmapId),
    ).toEqual([4]);
    expect(
      (await ask(cast, `pool=${EDITING}&q=freedom`)).body.rows.map((r) => r.beatmapId),
    ).toEqual([3]);
    expect((await ask(cast, `pool=${EDITING}&q=tech`)).body.rows.map((r) => r.beatmapId)).toEqual([
      2,
    ]);
  });

  it("gives stars under the current bucket's mods", async () => {
    const cast = await setup();
    server.use(ppBatchHandler(() => ppValues({ stars: 7.25 })));
    const { body } = await ask(cast, `pool=${EDITING}&under=DT`);
    expect(body.under).toBe("DT");
    expect(body.rows[0]?.values).toMatchObject({ stars: 7.25, source: "mirror" });
  });

  it("drops a deleted pool's candidates", async () => {
    const cast = await setup();
    await (await builtPoolsCollection()).deleteOne({ _id: OTHER });
    expect((await ask(cast, `pool=${EDITING}`)).body.total).toBe(2);
  });

  it("refuses visitors, a missing pool, and a pool the caller can't edit", async () => {
    const cast = await setup();
    const visitor = await GET(poolRequest("GET", `/api/candidates?pool=${EDITING}`, null));
    expect(visitor.status).toBe(401);
    expect((await ask(cast, "q=x")).response.status).toBe(400);
    expect((await ask(cast, `pool=${EDITING}`, "other")).response.status).toBe(404);
    expect((await ask(cast, `pool=${STRANGER}`)).response.status).toBe(404);
  });
});
