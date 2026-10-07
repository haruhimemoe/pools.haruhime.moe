/**
 * @file src/app/signin/page.tsx
 * @desc /signin?next=: sign-in lives on haruhime.moe, so this only sends the visitor to the hub's
 *       osu! sign-in (/api/signin/osu, straight to osu!), coming back to `next` (a safe pools path, /account otherwise) on pools.
 *       Kept so every "Sign in" link (the header, the command palette, old bookmarks) can stay a
 *       plain pools path while the hub's address comes from HUB_URL on the server.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Tue Oct 6, 2026
 */

import { pageMetadata } from "@haruhimemoe/next-kit/seo";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SEO_SITE } from "@/constants/seo";
import { hubSignInHref } from "@/lib/auth-session";

/** /signin's title; it's never indexed. */
export const metadata: Metadata = pageMetadata(SEO_SITE, {
  path: "/signin",
  title: "Sign in",
  index: false,
});

/**
 * @function SignInPage
 * @param props {PageProps<"/signin">} `next`
 * @returns {Promise<never>} a redirect to the hub's sign-in
 */
export default async function SignInPage({ searchParams }: PageProps<"/signin">): Promise<never> {
  const { next } = await searchParams;
  redirect(hubSignInHref(typeof next === "string" ? next : null));
}
