/**
 * @file src/components/auth/SignInWithOsu.tsx
 * @desc "Sign in with osu!": starts the OAuth redirect, then lands on `next`, or back on
 *       /signin?next=<next>&error=<code> when osu! or the admin check says no.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Sat Sep 26, 2026
 */

"use client";

import { Button } from "@haruhimemoe/ui";
import { useState } from "react";
import { OSU_PROVIDER_ID } from "@/constants/auth";
import { authClient } from "@/lib/auth-client";

const FAILED = "Couldn't start osu! sign-in. Try again.";

export function SignInWithOsu({ next }: { next: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onClick = async () => {
    setPending(true);
    setError(null);
    const { error: failed } = await authClient.signIn.social({
      provider: OSU_PROVIDER_ID,
      callbackURL: next,
      // better-auth adds &error=<code>; /signin explains it and keeps where to go next.
      errorCallbackURL: `/signin?next=${encodeURIComponent(next)}`,
    });
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
