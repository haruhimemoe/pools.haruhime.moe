/**
 * @file tests/unit/utils/similar-binary.test.ts
 * @desc Reading similar_maps rows: little-endian uint32 ids with one uint8 score each, as
 *       scripts/similar writes them (the bytes here are what its test fixture packs), ragged or
 *       short rows read as far as they're whole, zero ids and repeats dropped; the leaderboard
 *       list (nl, sl) read the same; scores as percents.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { describe, expect, it } from "vitest";
import { decodeNeighbors, encodeNeighbors, scorePercent } from "@/utils/similar-binary";

describe("decodeNeighbors", () => {
  it("reads the bytes the script writes", () => {
    // struct.pack("<2I", 7, 70000) and bytes([255, 128]) in scripts/similar/tests/test_store.py
    const n = Uint8Array.from([7, 0, 0, 0, 0x70, 0x11, 0x01, 0x00]);
    const s = Uint8Array.from([255, 128]);
    expect(decodeNeighbors(n, s)).toEqual([
      { id: 7, score: 255 },
      { id: 70000, score: 128 },
    ]);
  });

  it("reads the leaderboard list (nl, sl) the same way", () => {
    // struct.pack("<I", 9) and bytes([128]) for nl, sl in scripts/similar/tests/test_store.py
    const nl = Uint8Array.from([9, 0, 0, 0]);
    expect(decodeNeighbors(nl, Uint8Array.from([128]))).toEqual([{ id: 9, score: 128 }]);
  });

  it("reads a Node Buffer slice at its own offset", () => {
    const whole = Buffer.from([9, 9, 9, 1, 0, 0, 0]);
    expect(decodeNeighbors(whole.subarray(3), Uint8Array.from([10]))).toEqual([
      { id: 1, score: 10 },
    ]);
  });

  it("stops at the shorter of ids and scores and drops a ragged tail", () => {
    const { n } = encodeNeighbors([
      { id: 1, score: 0 },
      { id: 2, score: 0 },
    ]);
    const ragged = Uint8Array.from([...n, 5, 0]);
    expect(decodeNeighbors(ragged, Uint8Array.from([50, 60, 70]))).toEqual([
      { id: 1, score: 50 },
      { id: 2, score: 60 },
    ]);
    expect(decodeNeighbors(n, Uint8Array.from([50]))).toEqual([{ id: 1, score: 50 }]);
    expect(decodeNeighbors(new Uint8Array(), new Uint8Array())).toEqual([]);
  });

  it("drops zero ids (padding) and repeats", () => {
    const { n, s } = encodeNeighbors([
      { id: 4, score: 200 },
      { id: 0, score: 0 },
      { id: 4, score: 100 },
      { id: 4294967295, score: 90 },
    ]);
    expect(decodeNeighbors(n, s)).toEqual([
      { id: 4, score: 200 },
      { id: 4294967295, score: 90 },
    ]);
  });
});

describe("scorePercent", () => {
  it.each([
    [255, 100],
    [0, 0],
    [128, 50],
    [242, 95],
    [300, 100],
    [-4, 0],
  ])("reads %i as %i%%", (score, percent) => {
    expect(scorePercent(score)).toBe(percent);
  });
});
