/**
 * @file src/components/admin/BuiltPoolModeration.tsx
 * @desc One built pool's moderation buttons on /admin: Hide or Unhide (PATCH
 *       /api/admin/built-pools/<id>), and Delete, confirmed in the page with ui's InlineConfirm
 *       (no confirm() dialog): the first click asks "Delete <name> for good?" with focus on
 *       Cancel, which puts focus back on Delete; "Delete for good" deletes. The page refreshes
 *       after each change; what happened (a failure, or a pack removal packs will do later,
 *       included) is said in the table's live region (BuiltModerationArea), which keeps it and,
 *       once a pool is deleted, takes focus while its row goes.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Mon Sep 28, 2026
 */

"use client";

import { Button, InlineConfirm } from "@haruhimemoe/ui";
import { useRouter } from "next/navigation";
import { useContext, useState } from "react";
import { ModerationNotice } from "@/components/admin/BuiltModerationArea";

type Props = { id: string; name: string; hidden: boolean };

/**
 * @function BuiltPoolModeration
 * @param props {Props} the pool's id, name and whether moderators hid it
 * @returns {JSX.Element | null} Hide or Unhide and Delete; nothing once the pool is deleted
 */
export function BuiltPoolModeration({ id, name, hidden }: Props) {
  const router = useRouter();
  const say = useContext(ModerationNotice);
  const [pending, setPending] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const send = async (method: "PATCH" | "DELETE") => {
    setPending(true);
    say("");
    try {
      const response = await fetch(`/api/admin/built-pools/${id}`, {
        method,
        headers: { "Content-Type": "application/json" },
        ...(method === "PATCH" ? { body: JSON.stringify({ hidden: !hidden }) } : {}),
      });
      if (!response.ok) {
        say(`That didn't work for ${name} (${response.status}).`);
      } else if (method === "PATCH") {
        say(hidden ? `${name} shows again.` : `${name} is hidden.`);
      } else {
        const body =
          response.status === 200 ? ((await response.json()) as { notice?: string }) : {};
        // The buttons go at once (so focus can't return to them) and the refresh drops the row:
        // the message and focus go to the table's live region.
        setDeleted(true);
        say(`${name} is deleted. ${body.notice ?? ""}`.trim(), true);
      }
      router.refresh();
    } catch {
      say("That didn't reach the server.");
    } finally {
      setPending(false);
    }
  };
  if (deleted) return null;
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
      <InlineConfirm
        trigger="Delete"
        triggerProps={{ "aria-label": `Delete ${name}`, disabled: pending }}
        question={`Delete ${name} for good?`}
        confirmLabel="Delete for good"
        pendingLabel="Deleting…"
        onConfirm={() => send("DELETE")}
      />
    </div>
  );
}
