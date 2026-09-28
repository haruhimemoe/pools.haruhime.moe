/**
 * @file src/app/new/page.tsx
 * @desc /new: make a pool. Signed in, a form for its name and optional tournament, round and
 *       year that goes on to the new pool's editor. Signed out, a sign-in prompt that comes back
 *       here. Reads the session, so it's rendered per request; never indexed.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

import { Card, PageHeader } from "@haruhimemoe/ui";
import type { Metadata } from "next";
import { SignInWithOsu } from "@/components/auth/SignInWithOsu";
import { NewPoolForm } from "@/components/builder/NewPoolForm";
import { MAX_POOLS_PER_OWNER } from "@/constants/built-pools";
import { getCurrentUser } from "@/lib/auth-session";

export const metadata: Metadata = { title: "Make a pool", robots: { index: false } };

export default async function NewPoolPage() {
  const user = await getCurrentUser();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Make a pool"
        lead="Start with a name. The pool is private until you share it, and you add maps next."
      />
      {user ? (
        <Card>
          <NewPoolForm />
          <p className="mt-4 text-c3 text-xs">You can own up to {MAX_POOLS_PER_OWNER} pools.</p>
        </Card>
      ) : (
        <Card title="Sign in first" className="flex flex-col items-center gap-4 text-center">
          <p className="text-c2 text-sm">
            Making a pool needs your osu! account. You'll come back here after signing in.
          </p>
          <SignInWithOsu next="/new" />
        </Card>
      )}
    </div>
  );
}
