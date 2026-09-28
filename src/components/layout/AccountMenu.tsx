/**
 * @file src/components/layout/AccountMenu.tsx
 * @desc The header's account area. Client-side, so static pages stay static and read no cookies:
 *       the session comes from useAccount, which asks only when the signed-in marker is there.
 *       Nothing while loading; "Sign in" (returning to this page) when signed out; signed in, an
 *       avatar button (ui's HeaderMenu) that discloses Make a pool, Your pools, Account and
 *       Sign out. Escape closes it and puts focus back on the button; so does a click outside
 *       or on a link.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Mon Sep 28, 2026
 */

"use client";

import { signInHref } from "@haruhimemoe/next-kit/auth-react";
import { HeaderMenu } from "@haruhimemoe/ui";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { useAccount } from "@/lib/account";
import { avatarSrc } from "@/utils/avatar";

const ITEMS = [
  { href: "/new", label: "Make a pool" },
  { href: "/account#pools", label: "Your pools" },
  { href: "/account", label: "Account" },
] as const;

/**
 * @function AccountMenu
 * @returns {JSX.Element} nothing sized while the account loads, "Sign in" (back to this page)
 *          when signed out, else ui's HeaderMenu: the avatar and name, Make a pool, Your pools,
 *          Account and Sign out, closed by Escape, a click outside, a link or focus leaving it
 */
export function AccountMenu() {
  const account = useAccount();
  const pathname = usePathname();
  if (account.status === "loading") return <span aria-hidden="true" className="block h-7 w-16" />;
  if (account.status === "signed-out") {
    return (
      <Link
        href={signInHref(pathname || "/")}
        className="font-bold text-c3 text-sm transition-colors hover:text-c1"
      >
        Sign in
      </Link>
    );
  }
  const { username } = account.user;
  const avatar = avatarSrc(account.user.avatarUrl);
  return (
    <HeaderMenu
      label={
        <>
          {avatar ? (
            <Image src={avatar} alt="" width={28} height={28} className="rounded-full" />
          ) : null}
          <span>{username}</span>
        </>
      }
      items={ITEMS}
    >
      <SignOutButton variant="ghost" className="h-auto justify-start rounded px-3 py-2" />
    </HeaderMenu>
  );
}
