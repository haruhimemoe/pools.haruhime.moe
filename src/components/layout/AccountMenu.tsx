/**
 * @file src/components/layout/AccountMenu.tsx
 * @desc The header's account area. Client-side, so static pages stay static and read no cookies:
 *       the session comes from useAccount, which asks only when the signed-in marker is there.
 *       Nothing while loading; "Sign in" (returning to this page) when signed out; signed in, an
 *       avatar button that discloses Make a pool, Your pools, Account and Sign out. Escape closes
 *       it and puts focus back on the button; so does a click outside or on a link.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Mon Sep 28, 2026
 */

"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { useAccount } from "@/hooks/useAccount";
import { avatarSrc } from "@/utils/avatar";
import { signInHref } from "@/utils/safe-next";

const ITEM = "block rounded px-3 py-2 font-bold text-c2 text-sm hover:bg-b4 hover:text-c1";

export function AccountMenu() {
  const account = useAccount();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const id = useId();
  const wrapper = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
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
    <div ref={wrapper} className="relative">
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((was) => !was)}
        className="flex items-center gap-2 font-bold text-c1 text-sm transition-colors hover:text-h1"
      >
        {avatar ? (
          <Image src={avatar} alt="" width={28} height={28} className="rounded-full" />
        ) : null}
        <span>{username}</span>
      </button>
      {open ? (
        <div
          id={id}
          className="absolute right-0 z-10 mt-2 flex w-44 flex-col gap-1 rounded-lg border border-b3 bg-b6 p-2"
        >
          <Link href="/new" className={ITEM} onClick={() => setOpen(false)}>
            Make a pool
          </Link>
          <Link href="/account#pools" className={ITEM} onClick={() => setOpen(false)}>
            Your pools
          </Link>
          <Link href="/account" className={ITEM} onClick={() => setOpen(false)}>
            Account
          </Link>
          <SignOutButton variant="ghost" className="justify-start" />
        </div>
      ) : null}
    </div>
  );
}
