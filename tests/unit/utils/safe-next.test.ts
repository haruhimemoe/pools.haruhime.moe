/**
 * @file tests/unit/utils/safe-next.test.ts
 * @desc Post-sign-in destinations stay on this site; anything else (sign-in itself
 *       included, which would loop) lands on /account, a page every signed-in user can open.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Sun Sep 27, 2026
 */

import { describe, expect, it } from "vitest";
import { DEFAULT_AFTER_SIGN_IN, safeNextPath, signInHref } from "@/utils/safe-next";

describe("safeNextPath", () => {
  it("defaults to /account", () => {
    expect(DEFAULT_AFTER_SIGN_IN).toBe("/account");
  });

  it.each(["/new", "/p/abcdefghij/edit", "/me?tab=packs"])("keeps %j", (path) => {
    expect(safeNextPath(path)).toBe(path);
  });

  it.each([
    null,
    undefined,
    "",
    "new",
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "/ok\\..\\evil",
    "/\n//evil.example",
    `/${"a".repeat(600)}`,
    "/signin",
    "/signin?next=%2Fsignin",
  ])("replaces %j with the default", (raw) => {
    expect(safeNextPath(raw)).toBe(DEFAULT_AFTER_SIGN_IN);
  });
});

describe("signInHref", () => {
  it("encodes the destination", () => {
    expect(signInHref("/p/abc?x=1")).toBe("/signin?next=%2Fp%2Fabc%3Fx%3D1");
  });
});
