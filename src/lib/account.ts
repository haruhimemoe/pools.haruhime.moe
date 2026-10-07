/**
 * @file src/lib/account.ts
 * @desc The browser side of the hub session, from @haruhimemoe/next-kit/auth-react: the shared
 *       `haruhime-signed-in` marker (the hub sets it on .haruhime.moe; pools reads it, and clears
 *       it only through POST /api/signout), and one page-wide account store with its hook and
 *       RestoreSignedIn. The store asks pools' GET /api/session only when the marker is there,
 *       once per page load, so anonymous visitors cost no request. Sign-in happens on
 *       haruhime.moe: the header's "Sign in" goes through /signin (a redirect to the hub's osu!
 *       sign-in, back to this page). Sign-out stays on pools: POST /api/signout ends the session
 *       on the hub server-side and clears the cookies, then the store is told and the page
 *       refreshes (signOutHere, the header's menu and SignOutButton).
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Tue Oct 6, 2026
 */

"use client";

import {
  type Account,
  type BoundAccountMenuProps,
  createAccountStore,
  createSignedInMarker,
  AccountMenu as KitAccountMenu,
  RestoreSignedIn as KitRestoreSignedIn,
  SignOutButton as KitSignOutButton,
  type SessionData,
  useAccount as useKitAccount,
} from "@haruhimemoe/next-kit/auth-react";
import { createElement, type ReactNode } from "react";
import { SIGNED_IN_COOKIE } from "@/constants/site";

export type { Account };

/** The marker cookie: `has(cookieHeader)` (bb never clears it: only the hub writes it). */
export const signedInMarker = createSignedInMarker(SIGNED_IN_COOKIE);

/**
 * @function fetchSession
 * @returns {Promise<SessionData | null>} who /api/session says is signed in, or null
 * @throws when bb can't be reached or answers an error (the store reads that as signed out)
 */
const fetchSession = async (): Promise<SessionData | null> => {
  const response = await fetch("/api/session", { cache: "no-store" });
  if (!response.ok) throw new Error(`session ${response.status}`);
  const body = (await response.json()) as { user: SessionData["user"] | null };
  return body.user ? { user: body.user } : null;
};

/** The page-wide account store. */
export const accountStore = createAccountStore({
  getSession: fetchSession,
  readCookie: () => document.cookie,
  hasMarker: signedInMarker.has,
  // The marker lives on .haruhime.moe and is HttpOnly-free but domain-wide: POST /api/signout
  // clears it with the right Domain, so a stale one here just costs a request.
  clearMarker: () => undefined,
});

/**
 * @function useAccount
 * @returns {Account} who is signed in: loading, signed-out, or signed-in with id, username and
 *          avatar
 */
export const useAccount = (): Account => useKitAccount(accountStore);

/**
 * @function signOutHere
 * @returns {Promise<void>} once POST /api/signout ended the hub session and cleared its cookies
 * @throws when pools can't be reached or refuses (the caller stays signed in)
 */
export const signOutHere = async (): Promise<void> => {
  const response = await fetch("/api/signout", { method: "POST", cache: "no-store" });
  if (!response.ok) throw new Error(`signout ${response.status}`);
};

/**
 * @function RestoreSignedIn
 * @param props {{ next?: string; pending?: ReactNode }} where to go on once the session is read
 * @returns {ReactNode} next-kit's RestoreSignedIn bound to pools' store and the shared marker
 */
export const RestoreSignedIn = (props: { next?: string; pending?: ReactNode }): ReactNode =>
  createElement(KitRestoreSignedIn, {
    ...props,
    store: accountStore,
    hasMarker: signedInMarker.has,
  });

/**
 * @function AccountMenu
 * @param props {BoundAccountMenuProps} the menu's links and words
 * @returns {ReactNode} the header's account area: sign in (through /signin to the hub), or the
 *          avatar menu with `items` and Sign out (in place)
 */
export const AccountMenu = (props: BoundAccountMenuProps): ReactNode =>
  createElement(KitAccountMenu, {
    ...props,
    account: useAccount(),
    signOut: signOutHere,
    onSignedOut: accountStore.markSignedOut,
  });

/**
 * @function SignOutButton
 * @returns {ReactNode} next-kit's SignOutButton bound to signOutHere and the store: signs out,
 *          tells the header, goes home and refreshes
 */
export const SignOutButton = (): ReactNode =>
  createElement(KitSignOutButton, {
    signOut: signOutHere,
    onSignedOut: accountStore.markSignedOut,
  });
