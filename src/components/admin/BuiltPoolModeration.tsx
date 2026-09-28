/**
 * @file src/components/admin/BuiltPoolModeration.tsx
 * @desc One built pool's moderation buttons on /admin: Hide or Unhide (PATCH
 *       /api/admin/built-pools/<id>), and Delete, confirmed in the page (no confirm() dialog):
 *       the first click asks, "Delete for good" deletes. The page refreshes after each change;
 *       a failure, or a pack removal packs will do later, is said beside the buttons.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

"use client";

import { Button } from "@haruhimemoe/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = { id: string; name: string; hidden: boolean };

export function BuiltPoolModeration({ id, name, hidden }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState("");
  const send = async (method: "PATCH" | "DELETE") => {
    setPending(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/built-pools/${id}`, {
        method,
        headers: { "Content-Type": "application/json" },
        ...(method === "PATCH" ? { body: JSON.stringify({ hidden: !hidden }) } : {}),
      });
      if (!response.ok) setMessage(`That didn't work (${response.status}).`);
      else if (response.status === 200 && method === "DELETE") {
        const body = (await response.json()) as { notice?: string };
        setMessage(`Deleted. ${body.notice ?? ""}`.trim());
      }
      setConfirming(false);
      router.refresh();
    } catch {
      setMessage("That didn't reach the server.");
    } finally {
      setPending(false);
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="secondary"
        disabled={pending}
        onClick={() => send("PATCH")}
        aria-label={`${hidden ? "Unhide" : "Hide"} ${name}`}
      >
        {hidden ? "Unhide" : "Hide"}
      </Button>
      {confirming ? (
        <>
          <Button
            disabled={pending}
            onClick={() => send("DELETE")}
            aria-label={`Delete ${name} for good`}
          >
            Delete for good
          </Button>
          <Button variant="ghost" disabled={pending} onClick={() => setConfirming(false)}>
            Cancel
          </Button>
        </>
      ) : (
        <Button
          variant="secondary"
          disabled={pending}
          onClick={() => setConfirming(true)}
          aria-label={`Delete ${name}`}
        >
          Delete
        </Button>
      )}
      <output aria-live="polite" className="text-c2 text-xs">
        {message}
      </output>
    </div>
  );
}
