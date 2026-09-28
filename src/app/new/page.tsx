/**
 * @file src/app/new/page.tsx
 * @desc /new: make a pool. Signed in, a form for its name and optional tournament, round and
 *       year that goes on to the new pool's editor. /new?from=<id> ("Start from this pool" on a
 *       past or built pool's page) fills the form in from that pool and copies its maps into
 *       the new, private pool; a pool that isn't there to copy (unknown, hidden, or not the
 *       user's to see) is said, and the plain form shows. Nothing is made until the form is
 *       sent. Signed out, a sign-in prompt that comes back here, `from` included. Reads the
 *       session, so it's rendered per request; never indexed.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Mon Sep 28, 2026
 */

import { Card, Notice, PageHeader } from "@haruhimemoe/ui";
import type { Metadata } from "next";
import { SignInWithOsu } from "@/components/auth/SignInWithOsu";
import { NewPoolForm } from "@/components/builder/NewPoolForm";
import { MAX_POOLS_PER_OWNER } from "@/constants/built-pools";
import { getCurrentUser } from "@/lib/auth-session";
import { startPreview } from "@/services/built-pool-create";
import { startFromHref } from "@/utils/pool-links";

/** /new's title; it's never indexed. */
export const metadata: Metadata = { title: "Make a pool", robots: { index: false } };

/**
 * @function NewPoolPage
 * @param props {PageProps<"/new">} `from`, the pool to start from
 * @returns {Promise<JSX.Element>} the new pool form, or a sign-in prompt that comes back here
 */
export default async function NewPoolPage({ searchParams }: PageProps<"/new">) {
  const raw = (await searchParams).from;
  const from = typeof raw === "string" && raw !== "" ? raw.slice(0, 80) : null;
  const user = await getCurrentUser();
  const start = user && from ? await startPreview(from, user) : null;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={start ? "Start from a pool" : "Make a pool"}
        lead={
          start
            ? "A private copy of its maps, yours to change. Rename it if you like."
            : "Start with a name. The pool is private until you share it, and you add maps next."
        }
      />
      {user && from && !start ? (
        <Notice tone="warning">That pool isn't there to start from.</Notice>
      ) : null}
      {user ? (
        <Card>
          <NewPoolForm {...(start ? { startFrom: start } : {})} />
          <p className="mt-4 text-c3 text-xs">You can own up to {MAX_POOLS_PER_OWNER} pools.</p>
        </Card>
      ) : (
        <Card title="Sign in first" className="flex flex-col items-center gap-4 text-center">
          <p className="text-c2 text-sm">
            Making a pool needs your osu! account. You'll come back here after signing in.
          </p>
          <SignInWithOsu next={from ? startFromHref(from) : "/new"} />
        </Card>
      )}
    </div>
  );
}
