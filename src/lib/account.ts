/**
 * @file src/lib/account.ts
 * @desc The browser side of sign-in, from @haruhimemoe/next-kit/auth-react: the readable
 *       SIGNED_IN_COOKIE marker, and one page-wide account store with its hook, sign-out and
 *       RestoreSignedIn. useAccount asks the server only when the marker is there, once per page
 *       load, so anonymous visitors cost no request; markSignedOut updates every subscriber at
 *       once; RestoreSignedIn (on /signin and /account) asks for the session once when the
 *       marker is missing, and with `next` goes on there. The account components (sign in, sign
 *       out, the header's menu, delete my account) come bound to the client and the store.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

"use client";

import {
  createAccount,
  createAuthComponents,
  createSignedInMarker,
} from "@haruhimemoe/next-kit/auth-react";
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

const components = createAuthComponents(authClient, kit);

/** "Sign in with osu!", landing on `next`. */
export const SignInWithOsu = components.SignInWithOsu;

/** Signs out, tells the header, and goes home. */
export const SignOutButton = components.SignOutButton;

/** The header's account area: sign in, or the avatar menu with `items` and Sign out. */
export const AccountMenu = components.AccountMenu;

/** "Delete my account": type the username, then DELETE /api/account. */
export const DeleteAccountForm = components.DeleteAccountForm;
