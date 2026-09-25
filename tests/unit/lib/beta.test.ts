/**
 * @file tests/unit/lib/beta.test.ts
 * @desc The beta flag: on only while NEXT_PUBLIC_POOLS_BETA is "true" (trimmed), read on every
 *       call.
 * @author David @dvhsh (https://dvh.sh)
 * @created Fri Sep 25, 2026
 * @modified Fri Sep 25, 2026
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { isBeta } from "@/lib/beta";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isBeta", () => {
  it("is off when unset or blank", () => {
    vi.stubEnv("NEXT_PUBLIC_POOLS_BETA", undefined);
    expect(isBeta()).toBe(false);
    vi.stubEnv("NEXT_PUBLIC_POOLS_BETA", " ");
    expect(isBeta()).toBe(false);
  });

  it("is on for true, around spaces", () => {
    vi.stubEnv("NEXT_PUBLIC_POOLS_BETA", "true");
    expect(isBeta()).toBe(true);
    vi.stubEnv("NEXT_PUBLIC_POOLS_BETA", " true\n");
    expect(isBeta()).toBe(true);
  });

  it.each(["TRUE", "1", "yes", "false", "beta"])("is off for %j", (value) => {
    vi.stubEnv("NEXT_PUBLIC_POOLS_BETA", value);
    expect(isBeta()).toBe(false);
  });
});
