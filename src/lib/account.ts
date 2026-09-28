/**
 * @file src/lib/account.ts
 * @desc The browser side of sign-in, from @haruhimemoe/next-kit/auth-react: the readable
 *       SIGNED_IN_COOKIE marker, and one page-wide account store with its hook, sign-out and
 *       RestoreSignedIn. useAccount asks the server only when the marker is there, once per page
 *       load, so anonymous visitors cost no request; markSignedOut updates every subscriber at
 *       once; RestoreSignedIn (on /signin and /account) asks for the session once when the
 *       marker is missing, and with `next` goes on there.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

"use client";

import { createAccount, createSignedInMarker } from "@haruhimemoe/next-kit/auth-react";
import { SIGNED_IN_COOKIE } from "@/constants/site";
import { authClient } from "@/lib/auth-client";

export type { Account } from "@haruhimemoe/next-kit/auth-react";

/** The marker cookie: `has(cookieHeader)` and `clear()`. */
export const signedInMarker = createSignedInMarker(SIGNED_IN_COOKIE);

const kit = createAccount(authClient, signedInMarker);

/** The page-wide account store. */
export const accountStore = kit.store;

/** Who is signed in: loading, signed-out, or signed-in with id, username and avatar. */
export const useAccount = kit.useAccount;

/** Tells every subscriber at once that this browser signed out. */
export const markSignedOut = kit.markSignedOut;

/** Restores the marker for a session without one; with `next`, goes on there. */
export const RestoreSignedIn = kit.RestoreSignedIn;
