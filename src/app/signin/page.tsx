/**
 * @file src/app/signin/page.tsx
 * @desc /signin?next=: osu! sign-in for admins. A signed-in admin goes straight to `next`; a
 *       refused sign-in comes back with ?error.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { PageHeader } from "@haruhimemoe/ui";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignInWithOsu } from "@/components/auth/SignInWithOsu";
import { getCurrentAdmin } from "@/lib/auth-session";
import { safeNextPath } from "@/utils/safe-next";

export const metadata: Metadata = { title: "Admin sign-in", robots: { index: false } };

export default async function SignInPage({ searchParams }: PageProps<"/signin">) {
  const params = await searchParams;
  const next = safeNextPath(typeof params.next === "string" ? params.next : null);
  if (await getCurrentAdmin()) redirect(next);
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-6 py-10 text-center">
      <PageHeader
        title="Admin sign-in"
        lead="Only pools admins can sign in. Everything else on the site works without an account."
      />
      {params.error !== undefined ? (
        <p role="alert" className="font-bold text-rose-300 text-sm">
          Sign-in didn't finish. Only admins can sign in.
        </p>
      ) : null}
      <SignInWithOsu next={next} />
    </div>
  );
}
