/**
 * @file tests/integration/app/api/pool-og.test.ts
 * @desc GET /pools/<id>/og.png: a past pool and a public built pool get their card as a 1200×630
 *       PNG with a long CDN cache; a hidden past pool, an unlisted, private or hidden built pool
 *       and an unknown id get a 404.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { describe, expect, it } from "vitest";
import { GET } from "@/app/pools/[id]/og.png/route";
import { poolsCollection } from "@/models/Pool";
import { setupTestDb } from "../../../helpers/db";
import { createCast, insertPool } from "../../../helpers/pool-requests";
import { makePool } from "../../../helpers/records";

setupTestDb();

const get = (id: string) =>
  GET(new Request(`http://localhost/pools/${id}/og.png`), { params: Promise.resolve({ id }) });

const expectCard = async (response: Response) => {
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toBe("image/png");
  expect(response.headers.get("cache-control")).toContain("s-maxage=604800");
  const bytes = new Uint8Array(await response.arrayBuffer());
  const view = new DataView(bytes.buffer);
  expect(String.fromCharCode(...bytes.slice(1, 4))).toBe("PNG");
  expect([view.getUint32(16), view.getUint32(20)]).toEqual([1200, 630]);
};

describe("GET /pools/<id>/og.png", () => {
  it("draws a past pool's card, and 404s a hidden one", async () => {
    const pools = await poolsCollection();
    await pools.insertOne(makePool({ _id: "otdb-9" }));
    await pools.insertOne(
      makePool({ _id: "otdb-10", hidden: true, slots: [{ mod: "HD", index: 1, beatmapId: 1002 }] }),
    );
    await expectCard(await get("otdb-9"));
    expect((await get("otdb-10")).status).toBe(404);
    expect((await get("otdb-404")).status).toBe(404);
  });

  it("draws a public built pool's card and 404s the others", async () => {
    const cast = await createCast();
    await insertPool(cast, { _id: "b-a0000001", visibility: "public" });
    await insertPool(cast, { _id: "b-a0000002", visibility: "unlisted" });
    await insertPool(cast, { _id: "b-a0000003", visibility: "private" });
    await insertPool(cast, { _id: "b-a0000004", visibility: "public", hidden: true });
    await expectCard(await get("b-a0000001"));
    for (const id of ["b-a0000002", "b-a0000003", "b-a0000004", "b-a0000009"]) {
      expect((await get(id)).status).toBe(404);
    }
  });
});
