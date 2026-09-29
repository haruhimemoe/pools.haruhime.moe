/**
 * @file tests/unit/utils/similar-params.test.ts
 * @desc Find similar's request: the path id (a beatmap id or nothing), the query (lens as the
 *       browser reads it, NM for anything else; a star range; a built pool id or nothing), the
 *       URL the browser asks, and the query the browser builds from a bucket's target range.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { describe, expect, it } from "vitest";
import {
  parseSimilarId,
  parseSimilarQuery,
  similarApiUrl,
  similarQueryFor,
} from "@/utils/similar-params";

describe("parseSimilarId", () => {
  it.each([
    ["129891", 129891],
    ["0", null],
    ["-1", null],
    ["1.5", null],
    ["abc", null],
    ["12345678901", null],
  ])("reads %s as %s", (raw, id) => {
    expect(parseSimilarId(raw)).toBe(id);
  });
});

describe("parseSimilarQuery", () => {
  it("reads the lens, range and pool", () => {
    const query = parseSimilarQuery(new URLSearchParams("mods=hddt&sr=6-7.5&pool=b-a1234567"));
    expect(query).toEqual({ lens: "HDDT", sr: [6, 7.5], pool: "b-a1234567" });
  });

  it("reads anything unreadable as its default", () => {
    const query = parseSimilarQuery(new URLSearchParams("mods=XX&sr=9-2&pool=../x"));
    expect(query).toEqual({ lens: "NM", sr: null, pool: null });
    expect(parseSimilarQuery(new URLSearchParams())).toEqual({ lens: "NM", sr: null, pool: null });
  });
});

describe("similarApiUrl", () => {
  it("leaves NM and empty parts out", () => {
    expect(similarApiUrl(5, { lens: "NM", sr: null, pool: null })).toBe("/api/maps/5/similar");
    expect(similarApiUrl(5, { lens: "DT", sr: [6, null], pool: "b-a1234567" })).toBe(
      "/api/maps/5/similar?mods=DT&sr=6-&pool=b-a1234567",
    );
  });
});

describe("similarQueryFor", () => {
  it("takes the bucket's target range and the pool", () => {
    const targets = { HR: { count: 3, sr: { min: 6.2, max: 6.8 } }, NM: { count: 4 } };
    expect(similarQueryFor("HR", "HR", targets, "b-a1234567")).toEqual({
      lens: "HR",
      sr: [6.2, 6.8],
      pool: "b-a1234567",
    });
    expect(similarQueryFor("NM", "NM", targets, undefined)).toEqual({
      lens: "NM",
      sr: null,
      pool: null,
    });
    expect(similarQueryFor("DT", null, undefined, undefined).sr).toBeNull();
  });
});
