/**
 * @file src/app/signin/page.tsx
 * @desc /signin?next=: osu! sign-in, open to every osu! account, for making pools. A signed-in
 *       visitor continues to `next` through the browser, so a session without the readable
 *       signed-in marker gets it (and the header catches up) on the way. Every failed sign-in
 *       comes back here with ?error=<code>, which the page explains in plain words
 *       (src/utils/signin-errors.ts).
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Sun Oct 4, 2026
 */

import { pageMetadata } from "@haruhimemoe/next-kit/seo";
import { safeNextPath } from "@haruhimemoe/next-kit/server";
import { PageHeader, Text, TextLink } from "@haruhimemoe/ui";
import type { Metadata } from "next";
import { SEO_SITE } from "@/constants/seo";
import { DEFAULT_AFTER_SIGN_IN } from "@/constants/site";
import { RestoreSignedIn, SignInWithOsu } from "@/lib/account";
import { getCurrentUser } from "@/lib/auth-session";
import { signInErrorText } from "@/utils/signin-errors";

/** /signin's title; it's never indexed. */
export const metadata: Metadata = pageMetadata(SEO_SITE, {
  path: "/signin",
  title: "Sign in",
  index: false,
});

/**
 * @function SignInPage
 * @param props {PageProps<"/signin">} `next` and a sign-in `error` code
 * @returns {Promise<JSX.Element>} the osu! sign-in button with any error explained, or, signed in,
 *          a hand-off to `next`
 */
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
        <Text role="alert" tone="error" bold>
          {error}
        </Text>
      ) : null}
      <SignInWithOsu next={next} />
      <p className="text-c4 text-xs">
        We keep your osu! ID, username, avatar and country, and the pools you make. See the{" "}
        <TextLink href="/legal/privacy">privacy page</TextLink>.
      </p>
    </div>
  );
}
