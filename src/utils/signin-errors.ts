/**
 * @file src/utils/signin-errors.ts
 * @desc What /signin says for each error code better-auth sends back (every failure lands on
 *       /signin?...&error=<code>): a refused osu! account first, then a bad or stale state,
 *       sign-in cancelled on osu!, osu! not confirming it, and a plain line for anything else.
 *       When a URL carries error twice (old ?error=oauth&error=<code> links), the last wins.
 *       Pure.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sat Sep 26, 2026
 * @modified Sat Sep 26, 2026
 */

/** Error codes and what they mean, the admin refusal first. */
export const SIGN_IN_ERRORS: readonly { codes: readonly string[]; text: string }[] = [
  {
    // The user hook (not listed) or the session hook (no longer listed) refused the account.
    codes: ["unable_to_create_user", "unable_to_create_session"],
    text: "That osu! account isn't a pools admin.",
  },
  {
    codes: ["state_mismatch", "state_not_found", "please_restart_the_process"],
    text: "Sign-in took too long or started in another tab. Try again.",
  },
  {
    codes: ["access_denied"],
    text: "Sign-in was cancelled on osu!. Try again when you're ready.",
  },
  {
    codes: ["invalid_code", "no_code", "unable_to_get_user_info"],
    text: "osu! didn't confirm the sign-in. Try again.",
  },
];

const OTHER_ERROR = "Sign-in didn't finish. Try again.";

/**
 * @function signInErrorText
 * @param error {string | string[] | undefined} the page's `error` param (all of them, when
 *        there are several)
 * @returns {string | null} what to tell the admin, from the last error given; null for none
 */
export const signInErrorText = (error: string | string[] | undefined): string | null => {
  const code = Array.isArray(error) ? error.at(-1) : error;
  if (code === undefined || code === "") return null;
  return SIGN_IN_ERRORS.find(({ codes }) => codes.includes(code))?.text ?? OTHER_ERROR;
};
