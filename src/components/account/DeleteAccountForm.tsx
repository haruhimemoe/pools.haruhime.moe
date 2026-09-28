/**
 * @file src/components/account/DeleteAccountForm.tsx
 * @desc "Delete my account" on /account. The confirmation is built into the page (no confirm()
 *       dialog): the button stays off until the osu! username is typed exactly, then one DELETE
 *       /api/account carries it. On success the header shows signed out and the page says the
 *       account is deleted (the form doesn't come back) and goes home (when packs didn't answer,
 *       it stays to say the packs' removal waits, with a link home);
 *       a refusal or no answer is said in the page, and nothing was deleted.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Mon Sep 28, 2026
 */

"use client";

import { ButtonLink, TypeToConfirm } from "@haruhimemoe/ui";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { markSignedOut } from "@/lib/account";

const UNREACHABLE = "Couldn't reach pools. Your account is still there.";

const messageOf = async (response: Response): Promise<string> => {
  try {
    const body = (await response.json()) as { error?: { message?: string } };
    return body.error?.message ?? `Deleting failed (${response.status}).`;
  } catch {
    return `Deleting failed (${response.status}).`;
  }
};

/**
 * @function DeleteAccountForm
 * @param props {{ username: string }} the signed-in osu! username, typed to confirm
 * @returns {JSX.Element} the typed-name confirmation (ui's TypeToConfirm), or what happened
 */
export function DeleteAccountForm({ username }: { username: string }) {
  const router = useRouter();
  const id = useId();
  const [error, setError] = useState<string | null>(null);
  // Once it's gone: what to say (packs' removal waiting, or nothing more). The form doesn't come
  // back, so a press while the page goes can't send the delete again.
  const [done, setDone] = useState<string | null>(null);
  const remove = async () => {
    setError(null);
    try {
      const response = await fetch("/api/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
      if (response.status === 204) {
        markSignedOut();
        setDone("");
        router.push("/");
      } else if (response.ok) {
        markSignedOut();
        const body = (await response.json().catch(() => ({}))) as { notice?: string };
        setDone(body.notice ?? "");
      } else {
        setError(await messageOf(response));
      }
    } catch {
      setError(UNREACHABLE);
    }
  };
  if (done !== null) {
    return (
      <div className="flex flex-col gap-3">
        <p role="status" className="text-c2 text-sm">
          {`Your account is deleted. ${done}`.trim()}
        </p>
        <ButtonLink href="/" variant="secondary" className="self-start">
          Go to the home page
        </ButtonLink>
      </div>
    );
  }
  return (
    <TypeToConfirm
      id={id}
      expected={username}
      submitLabel="Delete my account"
      pendingLabel="Deleting…"
      error={error}
      onConfirm={remove}
    >
      <p className="text-c2 text-sm">
        This deletes your account and every pool you own (with its pack on packs), takes you off the
        pools you edit, and signs you out everywhere. It can't be undone.
      </p>
    </TypeToConfirm>
  );
}
