/**
 * @file src/components/account/DeleteAccountForm.tsx
 * @desc "Delete my account" on /account. The confirmation is built into the page (no confirm()
 *       dialog): the button stays off until the osu! username is typed exactly, then one DELETE
 *       /api/account carries it. On success the header shows signed out and the page goes home;
 *       a refusal or no answer is said in the page, and nothing was deleted.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

"use client";

import { Button, TextInput } from "@haruhimemoe/ui";
import { useRouter } from "next/navigation";
import { type FormEvent, useId, useState } from "react";
import { markSignedOut } from "@/hooks/useAccount";

const UNREACHABLE = "Couldn't reach pools. Your account is still there.";

const messageOf = async (response: Response): Promise<string> => {
  try {
    const body = (await response.json()) as { error?: { message?: string } };
    return body.error?.message ?? `Deleting failed (${response.status}).`;
  } catch {
    return `Deleting failed (${response.status}).`;
  }
};

export function DeleteAccountForm({ username }: { username: string }) {
  const router = useRouter();
  const id = useId();
  const [typed, setTyped] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const matches = typed.trim() === username;
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!matches) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: typed.trim() }),
      });
      if (response.status === 204) {
        markSignedOut();
        router.push("/");
        return;
      }
      setError(await messageOf(response));
    } catch {
      setError(UNREACHABLE);
    }
    setPending(false);
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <p className="text-c2 text-sm">
        This deletes your account and every pool you own (with its pack on packs), takes you off the
        pools you edit, and signs you out everywhere. It can't be undone.
      </p>
      <TextInput
        id={id}
        label={`Type ${username} to confirm`}
        value={typed}
        autoComplete="off"
        spellCheck={false}
        onChange={(event) => setTyped(event.target.value)}
      />
      <Button
        type="submit"
        variant="secondary"
        className="self-start"
        disabled={!matches || pending}
      >
        {pending ? "Deleting…" : "Delete my account"}
      </Button>
      {error ? (
        <p role="alert" className="font-bold text-rose-300 text-sm">
          {error}
        </p>
      ) : null}
    </form>
  );
}
