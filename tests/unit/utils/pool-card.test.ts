/**
 * @file tests/unit/utils/pool-card.test.ts
 * @desc Pool link preview cards: what a past or built pool's card says (year, map count, stars
 *       and mods when known) and the versioned /pools/<id>/og.png image.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { describe, expect, it } from "vitest";
import { poolCard, poolCardImage } from "@/utils/pool-card";

const POOL = {
  name: "Enigmatic Summer Solstice Groups (Tier 2)",
  year: 2025,
  slots: [{ mod: "NM" }, { mod: "NM" }, { mod: "HD" }, { mod: null }, { mod: "DT" }],
  stats: { srMin: 4.55, srMax: 5.564 },
};

describe("poolCard", () => {
  it("names the pool over its year, map count, star range and mods", () => {
    expect(poolCard(POOL)).toEqual({
      eyebrow: "osu! tournament mappool",
      title: POOL.name,
      subtitle: "2025 · 5 maps · 4.55–5.56★ · NM HD DT",
    });
  });

  it("leaves out what isn't known and takes another eyebrow", () => {
    const card = poolCard({ name: "Cup", year: null, slots: [{ mod: null }] }, "Built pool");
    expect(card).toEqual({ eyebrow: "Built pool", title: "Cup", subtitle: "1 map" });
  });
});

describe("poolCardImage", () => {
  it("links /pools/<id>/og.png, versioned by the card's text", () => {
    const image = poolCardImage("otdb-99", poolCard(POOL));
    expect(image).toMatchObject({ width: 1200, height: 630, type: "image/png" });
    expect(image.url).toMatch(/^\/pools\/otdb-99\/og\.png\?v=\w+$/);
    expect(poolCardImage("otdb-99", poolCard(POOL)).url).toBe(image.url);
    expect(poolCardImage("otdb-99", poolCard({ ...POOL, name: "Other" })).url).not.toBe(image.url);
  });
});
