/**
 * @file src/app/signin/page.tsx
 * @desc /signin?next=: osu! sign-in, open to every osu! account, for making pools. A signed-in
 *       visitor continues to `next` through the browser, so a session without the readable
 *       signed-in marker gets it (and the header catches up) on the way. Every failed sign-in
 *       comes back here with ?error=<code>, which the page explains in plain words
 *       (src/utils/signin-errors.ts).
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Mon Sep 28, 2026
 */

import { safeNextPath } from "@haruhimemoe/next-kit/server";
import { PageHeader } from "@haruhimemoe/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { SignInWithOsu } from "@/components/auth/SignInWithOsu";
import { DEFAULT_AFTER_SIGN_IN } from "@/constants/site";
import { RestoreSignedIn } from "@/lib/account";
import { getCurrentUser } from "@/lib/auth-session";
import { signInErrorText } from "@/utils/signin-errors";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default async function SignInPage({ searchParams }: PageProps<"/signin">) {
  const params = await searchParams;
  const next = safeNextPath(typeof params.next === "string" ? params.next : null, {
    fallback: DEFAULT_AFTER_SIGN_IN,
  });
  if (await getCurrentUser()) return <RestoreSignedIn next={next} />;
  const error = signInErrorText(params.error);
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-6 py-10 text-center">
      <PageHeader
        title="Sign in"
        lead="Sign in with your osu! account to make pools. Searching maps, checking a pool and past pools all work without an account."
      />
      {error ? (
        <p role="alert" className="font-bold text-rose-300 text-sm">
          {error}
        </p>
      ) : null}
      <SignInWithOsu next={next} />
      <p className="text-c4 text-xs">
        We keep your osu! ID, username, avatar and country, and the pools you make. See the{" "}
        <Link href="/legal/privacy" className="underline underline-offset-2 hover:text-c1">
          privacy page
        </Link>
        .
      </p>
    </div>
  );
}
