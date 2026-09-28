/**
 * @file src/components/auth/SignOutButton.tsx
 * @desc Signs out, forgets the signed-in marker once the session is really gone (so the header
 *       flips without a reload), then goes home and refreshes server components.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Sun Sep 27, 2026
 */

"use client";

import { Button, type ButtonVariant } from "@haruhimemoe/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { markSignedOut } from "@/hooks/useAccount";
import { authClient } from "@/lib/auth-client";

const defaultSignOut = async (): Promise<void> => {
  await authClient.signOut();
};

type SignOutButtonProps = {
  /** The sign-out call (tests). */
  signOut?: () => Promise<void>;
  variant?: ButtonVariant;
  className?: string;
};

export function SignOutButton({
  signOut = defaultSignOut,
  variant = "secondary",
  className,
}: SignOutButtonProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const onClick = async () => {
    setPending(true);
    await signOut().then(markSignedOut, () => undefined);
    router.replace("/");
    router.refresh();
  };
  return (
    <Button variant={variant} className={className} onClick={onClick} disabled={pending}>
      {pending ? "Signing out…" : "Sign out"}
    </Button>
  );
}
