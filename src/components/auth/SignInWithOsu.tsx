/**
 * @file src/components/auth/SignInWithOsu.tsx
 * @desc "Sign in with osu!": starts the OAuth redirect, then lands on `next`, or back on
 *       /signin?next=<next>&error=<code> when osu! or the admin check says no.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Mon Sep 28, 2026
 */

"use client";

import { osuSignIn } from "@haruhimemoe/next-kit/auth-react";
import { Button } from "@haruhimemoe/ui";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

const FAILED = "Couldn't start osu! sign-in. Try again.";

/**
 * @function SignInWithOsu
 * @param props {{ next: string }} where to land after signing in
 * @returns {JSX.Element} the "Sign in with osu!" button, with an error when sign-in can't start
 */
export function SignInWithOsu({ next }: { next: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onClick = async () => {
    setPending(true);
    setError(null);
    // better-auth adds &error=<code> to the error URL; /signin explains it and keeps `next`.
    const { error: failed } = await authClient.signIn.social(osuSignIn(next));
    if (failed) {
      setError(failed.message ?? FAILED);
      setPending(false);
    }
  };
  return (
    <div className="flex flex-col items-center gap-2">
      <Button size="lg" onClick={onClick} disabled={pending}>
        {pending ? "Opening osu!…" : "Sign in with osu!"}
      </Button>
      {error ? (
        <p role="alert" className="font-bold text-rose-300 text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}
