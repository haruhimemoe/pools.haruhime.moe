/**
 * @file tests/unit/utils/signin-errors.test.ts
 * @desc What /signin says for each error code better-auth sends back: a refused osu! account
 *       first (not_admin: "That osu! account isn't a pools admin."), a user or session write
 *       that failed (a database problem, never read as a refusal), a bad or stale state, sign-in cancelled
 *       on osu!, osu! not confirming it, and anything else; no error, nothing. When a URL carries
 *       error twice (old ?error=oauth&error=<code> links), the last one wins.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sat Sep 26, 2026
 * @modified Sat Sep 26, 2026
 */

import { describe, expect, it } from "vitest";
import { NOT_ADMIN_ERROR, SIGN_IN_ERRORS, signInErrorText } from "@/utils/signin-errors";

describe("signInErrorText", () => {
  it("says a refused account isn't an admin, first", () => {
    expect(SIGN_IN_ERRORS[0]?.text).toBe("That osu! account isn't a pools admin.");
    expect(NOT_ADMIN_ERROR).toBe("not_admin");
    expect(signInErrorText("not_admin")).toBe("That osu! account isn't a pools admin.");
  });

  it("doesn't read a failed user or session write as a refusal", () => {
    for (const code of ["unable_to_create_user", "unable_to_create_session"]) {
      expect(signInErrorText(code)).toBe(
        "Couldn't finish signing in. Try again, or tell us on Discord if it keeps happening.",
      );
    }
  });

  it.each([
    ["state_mismatch", "Sign-in took too long or started in another tab. Try again."],
    ["state_not_found", "Sign-in took too long or started in another tab. Try again."],
    ["access_denied", "Sign-in was cancelled on osu!. Try again when you're ready."],
    ["invalid_code", "osu! didn't confirm the sign-in. Try again."],
    ["unable_to_get_user_info", "osu! didn't confirm the sign-in. Try again."],
    ["oauth", "Sign-in didn't finish. Try again."],
    ["something_new", "Sign-in didn't finish. Try again."],
  ])("explains %s", (code, text) => {
    expect(signInErrorText(code)).toBe(text);
  });

  it("says nothing without an error, and reads the last of several", () => {
    expect(signInErrorText(undefined)).toBeNull();
    expect(signInErrorText("")).toBeNull();
    expect(signInErrorText(["oauth", "state_mismatch"])).toBe(
      "Sign-in took too long or started in another tab. Try again.",
    );
  });
});
