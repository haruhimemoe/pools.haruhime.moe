/**
 * @file src/components/admin/BuiltPoolModeration.tsx
 * @desc One built pool's moderation buttons on /admin: Hide or Unhide (PATCH
 *       /api/admin/built-pools/<id>), and Delete, confirmed in the page (no confirm() dialog):
 *       the first click asks and focuses "Delete for good", which deletes; Cancel puts focus
 *       back on Delete. The page refreshes after each change; what happened (a failure, or a
 *       pack removal packs will do later, included) is said in the table's live region
 *       (BuiltModerationArea), which keeps it, and takes focus, once a deleted pool's row is
 *       gone.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Mon Sep 28, 2026
 */

"use client";

import { Button } from "@haruhimemoe/ui";
import { useRouter } from "next/navigation";
import { useContext, useEffect, useRef, useState } from "react";
import { ModerationNotice } from "@/components/admin/BuiltModerationArea";

type Props = { id: string; name: string; hidden: boolean };

export function BuiltPoolModeration({ id, name, hidden }: Props) {
  const router = useRouter();
  const say = useContext(ModerationNotice);
  const [pending, setPending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const askDelete = useRef<HTMLButtonElement>(null);
  const confirmDelete = useRef<HTMLButtonElement>(null);
  // Focus follows the Delete / "Delete for good" swap, so it never falls to the page.
  const swapped = useRef(false);
  useEffect(() => {
    if (!swapped.current) return;
    swapped.current = false;
    (confirming ? confirmDelete : askDelete).current?.focus();
  }, [confirming]);
  const confirm = (asking: boolean) => {
    swapped.current = true;
    setConfirming(asking);
  };
  const done = async (method: "PATCH" | "DELETE", response: Response) => {
    if (!response.ok) {
      swapped.current = method === "DELETE";
      return say(`That didn't work for ${name} (${response.status}).`);
    }
    if (method === "PATCH") return say(hidden ? `${name} shows again.` : `${name} is hidden.`);
    const body = response.status === 200 ? ((await response.json()) as { notice?: string }) : {};
    // The refreshed page drops the row: the message and focus go to the table's live region.
    say(`${name} is deleted. ${body.notice ?? ""}`.trim(), true);
  };
  const send = async (method: "PATCH" | "DELETE") => {
    setPending(true);
    say("");
    try {
      const response = await fetch(`/api/admin/built-pools/${id}`, {
        method,
        headers: { "Content-Type": "application/json" },
        ...(method === "PATCH" ? { body: JSON.stringify({ hidden: !hidden }) } : {}),
      });
      await done(method, response);
      setConfirming(false);
      router.refresh();
    } catch {
      say("That didn't reach the server.");
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
            ref={confirmDelete}
            disabled={pending}
            onClick={() => send("DELETE")}
            aria-label={`Delete for good: ${name}`}
          >
            Delete for good
          </Button>
          <Button variant="ghost" disabled={pending} onClick={() => confirm(false)}>
            Cancel
          </Button>
        </>
      ) : (
        <Button
          ref={askDelete}
          variant="secondary"
          disabled={pending}
          onClick={() => confirm(true)}
          aria-label={`Delete ${name}`}
        >
          Delete
        </Button>
      )}
    </div>
  );
}
