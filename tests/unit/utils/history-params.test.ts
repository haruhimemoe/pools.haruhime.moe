/**
 * @file tests/unit/utils/history-params.test.ts
 * @desc seqParam reads a non-negative integer from an untrusted query value, and nothing else.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Oct 5, 2026
 * @modified Mon Oct 5, 2026
 */

import { describe, expect, it } from "vitest";
import { seqParam } from "@/utils/history-params";

describe("seqParam", () => {
  it("reads a non-negative integer", () => {
    expect(seqParam("0")).toBe(0);
    expect(seqParam("42")).toBe(42);
  });

  it("is undefined for anything else", () => {
    expect(seqParam(undefined)).toBeUndefined();
    expect(seqParam("-1")).toBeUndefined();
    expect(seqParam("1.5")).toBeUndefined();
    expect(seqParam("x")).toBeUndefined();
    expect(seqParam(["1", "2"])).toBeUndefined();
  });
});
