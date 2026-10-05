/**
 * @file src/components/admin/BuiltPoolModeration.tsx
 * @desc One built pool's moderation buttons on /admin: Hide or Unhide (PATCH
 *       /api/admin/built-pools/<id>), and Delete, confirmed in a dialog with ui's ConfirmDialog
 *       (no confirm()): "Delete <name> for good?" with focus on Cancel. The page refreshes
 *       after each change; what happened (a failure, or a pack removal packs will do later,
 *       included) is said in the table's live region (BuiltModerationArea). A failed delete is
 *       said in the dialog; once a pool is deleted, the buttons go and focus lands on the
 *       table's live region.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Mon Oct 5, 2026
 */

"use client";

import { Button, ConfirmDialog } from "@haruhimemoe/ui";
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
  // Resolves to what went wrong, or null.
  const send = async (method: "PATCH" | "DELETE"): Promise<string | null> => {
    setPending(true);
    say("");
    try {
      const response = await fetch(`/api/admin/built-pools/${id}`, {
        method,
        headers: { "Content-Type": "application/json" },
        ...(method === "PATCH" ? { body: JSON.stringify({ hidden: !hidden }) } : {}),
      });
      const failure = response.ok ? null : `That didn't work for ${name} (${response.status}).`;
      if (!failure && method === "PATCH") {
        say(hidden ? `${name} shows again.` : `${name} is hidden.`);
      } else if (!failure) {
        const body =
          response.status === 200 ? ((await response.json()) as { notice?: string }) : {};
        // The buttons go at once and the refresh drops the row: the dialog hands focus to the
        // table's live region, which keeps the message.
        setDeleted(true);
        say(`${name} is deleted. ${body.notice ?? ""}`.trim());
      }
      router.refresh();
      return failure;
    } catch {
      return "That didn't reach the server.";
    } finally {
      setPending(false);
    }
  };
  const toggleHidden = async () => {
    const failure = await send("PATCH");
    if (failure) say(failure);
  };
  const remove = async () => {
    const failure = await send("DELETE");
    if (failure) throw new Error(failure);
  };
  if (deleted) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="secondary"
        disabled={pending}
        onClick={toggleHidden}
        aria-label={`${hidden ? "Unhide" : "Hide"} ${name}`}
      >
        {hidden ? "Unhide" : "Hide"}
      </Button>
      <ConfirmDialog
        trigger="Delete"
        triggerProps={{ "aria-label": `Delete ${name}`, disabled: pending }}
        title={`Delete ${name} for good?`}
        description="It goes for its owner and editors too, with its pack on packs. This can't be undone."
        tone="destructive"
        confirmLabel="Delete for good"
        pendingLabel="Deleting…"
        failedMessage={(error) => (error as Error).message}
        returnFocus={() => document.querySelector<HTMLElement>("[data-moderation-region]")}
        onConfirm={remove}
      />
    </div>
  );
}
