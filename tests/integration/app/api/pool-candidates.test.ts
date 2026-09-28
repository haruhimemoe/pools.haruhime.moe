/**
 * @file tests/integration/app/api/pool-candidates.test.ts
 * @desc Candidates through the routes, over a real (in-memory) database: the owner and an editor
 *       add, vote, note and promote them (each change a new version, a stale one a 409, the
 *       activity log naming every op but votes), anyone else is refused; the pool's API view
 *       carries them (with the caller's osu! id) only for the owner and editors, never for a
 *       visitor, another user or an admin, and counts only current members' votes; the pack
 *       packs gets holds the picks alone.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { setupMsw } from "@haruhimemoe/next-kit/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as getActivity } from "@/app/api/pools/[id]/activity/route";
import { POST as postOps } from "@/app/api/pools/[id]/ops/route";
import { GET as getPool } from "@/app/api/pools/[id]/route";
import { syncBuiltPack } from "@/services/built-pack-sync";
import { findBuiltPool } from "@/services/built-pool-read";
import { EMPTY_BUILT_PACK } from "@/utils/built-pack";
import { candidate } from "../../../helpers/candidates";
import { setupTestDb } from "../../../helpers/db";
import {
  createdAnswer,
  type PutCall,
  packsPutHandler,
  TEST_SERVICE,
} from "../../../helpers/packs-server";
import {
  type Cast,
  createCast,
  insertPool,
  params,
  poolRequest,
} from "../../../helpers/pool-requests";

setupTestDb();
const server = setupMsw();

const ID = "b-a0000001";
const NM1 = { bucket: "NM", index: 1 };
const SLOTS = [{ mod: "NM", index: 1, beatmapId: 100 }];
const STORED = { "NM:1": [candidate(101, { votes: [10, 20, 99] })], "NM:2": [candidate(102)] };

type Who = keyof Cast | "visitor";
type View = { version: number; candidates?: Record<string, { votes: number[] }[]>; me?: number };

const send = (cast: Cast, baseVersion: number, ops: unknown[], who: keyof Cast = "owner") =>
  postOps(
    poolRequest("POST", `/api/pools/${ID}/ops`, cast[who].cookie, { baseVersion, ops }),
    params({ id: ID }),
  );
const read = async (cast: Cast, who: Who) => {
  const cookie = who === "visitor" ? null : cast[who].cookie;
  const response = await getPool(
    poolRequest("GET", `/api/pools/${ID}`, cookie),
    params({ id: ID }),
  );
  return { status: response.status, body: (await response.json()) as { pool: View } };
};

describe("candidate ops through the route", () => {
  it("adds, votes, notes and promotes, a version each, logging all but votes", async () => {
    const cast = await createCast();
    await insertPool(cast, { _id: ID, slots: SLOTS });
    const add = { type: "addCandidate", slot: NM1, beatmapId: 101, beatmapsetId: 1010 };
    expect((await send(cast, 1, [add], "editor")).status).toBe(200);
    const vote = { type: "voteCandidate", slot: NM1, beatmapId: 101, on: true };
    expect((await send(cast, 2, [vote])).status).toBe(200);
    expect((await send(cast, 3, [vote], "editor")).status).toBe(200);
    const note = { type: "setCandidateNote", slot: NM1, beatmapId: 101, note: "safer" };
    expect((await send(cast, 4, [note])).status).toBe(200);
    expect((await findBuiltPool(ID))?.candidates?.["NM:1"]?.[0]).toMatchObject({
      beatmapId: 101,
      beatmapsetId: 1010,
      addedBy: 20,
      note: "safer",
      votes: [10, 20],
    });
    const promote = { type: "promoteCandidate", slot: NM1, beatmapId: 101, pickSetId: 1000 };
    expect((await send(cast, 5, [promote])).status).toBe(200);
    const stored = await findBuiltPool(ID);
    expect(stored?.slots).toEqual([{ mod: "NM", index: 1, beatmapId: 101 }]);
    expect(stored?.slotNotes).toEqual({ 101: "safer" });
    expect(stored?.candidates?.["NM:1"]?.map((c) => c.beatmapId)).toEqual([100]);
    const log = await getActivity(
      poolRequest("GET", `/api/pools/${ID}/activity`, cast.owner.cookie),
      params({ id: ID }),
    );
    const { activity } = (await log.json()) as { activity: { kind: string }[] };
    expect(activity.map((entry) => entry.kind)).toEqual([
      "candidate-promote",
      "candidate-note",
      "candidate-add",
    ]);
  });

  it("answers a stale version with 409 and refuses anyone but the owner and editors", async () => {
    const cast = await createCast();
    await insertPool(cast, { _id: ID, slots: SLOTS, visibility: "public" });
    const add = { type: "addCandidate", slot: NM1, beatmapId: 101, beatmapsetId: 1 };
    expect((await send(cast, 2, [add])).status).toBe(409);
    expect((await send(cast, 1, [add], "other")).status).toBe(403);
    expect((await send(cast, 1, [add], "admin")).status).toBe(403);
    const onPick = await send(cast, 1, [{ ...add, beatmapId: 100 }]);
    expect(onPick.status).toBe(400);
    expect((await onPick.json()) as { error: { code: string } }).toMatchObject({
      error: { code: "candidate_is_pick" },
    });
    expect((await findBuiltPool(ID))?.candidates).toBeUndefined();
  });
});

describe("who sees candidates", () => {
  it.each<[Who, boolean]>([
    ["owner", true],
    ["editor", true],
    ["other", false],
    ["admin", false],
    ["visitor", false],
  ])("the API view for %s carries them: %s", async (who, shown) => {
    const cast = await createCast();
    await insertPool(cast, { _id: ID, slots: SLOTS, visibility: "public", candidates: STORED });
    const { status, body } = await read(cast, who);
    expect(status).toBe(200);
    expect("candidates" in body.pool).toBe(shown);
    expect("me" in body.pool).toBe(shown);
    expect(JSON.stringify(body).includes("102")).toBe(shown);
  });

  it("counts only the owner's and current editors' votes", async () => {
    const cast = await createCast();
    await insertPool(cast, { _id: ID, slots: SLOTS, candidates: STORED });
    const { body } = await read(cast, "editor");
    expect(body.pool.me).toBe(20);
    expect(body.pool.candidates?.["NM:1"]?.[0]?.votes).toEqual([10, 20]);
  });
});

describe("packs", () => {
  beforeEach(() => {
    vi.stubEnv("POOLS_SERVICE_TOKEN", TEST_SERVICE.token);
    vi.stubEnv("PACKS_URL", TEST_SERVICE.url);
  });
  afterEach(() => {
    vi.stubEnv("POOLS_SERVICE_TOKEN", "");
    vi.stubEnv("PACKS_URL", "");
  });

  it("sends the picks alone, never a candidate", async () => {
    const cast = await createCast();
    const calls: PutCall[] = [];
    server.use(packsPutHandler(createdAnswer, calls));
    const pack = { ...EMPTY_BUILT_PACK, state: "pending" as const };
    await insertPool(cast, {
      _id: ID,
      slots: SLOTS,
      visibility: "public",
      pack,
      candidates: STORED,
    });
    expect(await syncBuiltPack(ID)).toBe(true);
    expect(calls[0]?.body).toMatchObject({ slots: SLOTS });
    expect(JSON.stringify(calls[0]?.body)).not.toMatch(/10[12]/);
  });
});
