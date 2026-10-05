/**
 * @file src/components/builder/DeletePoolForm.tsx
 * @desc The owner's "Delete this pool": a button that opens ui's ConfirmDialog, where the pool's
 *       name is typed before DELETE /api/pools/<id> runs in turn with the editor's changes. On
 *       success it says the pool is deleted (the button doesn't come back), focuses that line
 *       and goes to your pools. A refusal or no answer is said in the dialog and nothing was
 *       deleted. When packs didn't answer, the pool is deleted anyway: the page says its pack's
 *       removal waits and links back to your pools.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Mon Oct 5, 2026
 */

"use client";

import { ButtonLink, ConfirmDialog } from "@haruhimemoe/ui";
import { useState } from "react";
import { callPools, type Fetcher } from "@/lib/pool-client";
import type { PoolEditor } from "@/schemas/pool-editor";

type DeleteAnswer = { packRemoval?: "queued"; notice?: string } | null;

type DeletePoolFormProps = {
  poolId: string;
  name: string;
  editor: Pick<PoolEditor, "exclusive">;
  onDeleted: () => void;
  fetcher?: Fetcher;
};

const DONE_ID = "delete-pool-done";

/**
 * @function DeletePoolForm
 * @param props {DeletePoolFormProps} the pool's id and name, the editor, what to do after, and a
 *        fetcher (tests)
 * @returns {JSX.Element} the delete button and its dialog, or what happened to the pack
 */
export function DeletePoolForm({
  poolId,
  name,
  editor,
  onDeleted,
  fetcher = fetch,
}: DeletePoolFormProps) {
  // Once it's gone: what to say (packs' removal waiting, or nothing more).
  const [done, setDone] = useState<string | null>(null);
  // Throws to keep the dialog open with what went wrong.
  const remove = async () => {
    const answer = await editor.exclusive(() =>
      callPools<DeleteAnswer>(fetcher, `/api/pools/${poolId}`, { method: "DELETE" }),
    );
    if (!answer.ok) throw new Error(`${answer.message} The pool is still there.`);
    if (answer.body?.packRemoval === "queued") {
      setDone(answer.body.notice ?? "");
      return;
    }
    setDone("");
    onDeleted();
  };
  if (done !== null) {
    return (
      <div className="flex flex-col gap-3">
        <p id={DONE_ID} role="status" tabIndex={-1} className="text-c2 text-sm outline-none">
          {`The pool is deleted. ${done}`.trim()}
        </p>
        <ButtonLink href="/account#pools" variant="secondary">
          Back to your pools
        </ButtonLink>
      </div>
    );
  }
  return (
    <ConfirmDialog
      trigger="Delete this pool"
      triggerProps={{ variant: "danger" }}
      title={`Delete ${name}?`}
      description="This deletes the pool for you and everyone who edits it. It can't be undone."
      tone="destructive"
      typeToConfirm={name}
      confirmLabel="Delete for good"
      pendingLabel="Deleting…"
      failedMessage={(error) => (error as Error).message}
      returnFocus={() => document.getElementById(DONE_ID)}
      onConfirm={remove}
    />
  );
}
