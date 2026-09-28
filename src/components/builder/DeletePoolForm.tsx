/**
 * @file src/components/builder/DeletePoolForm.tsx
 * @desc The owner's "Delete this pool". The confirmation is in the page (no confirm() dialog):
 *       the button stays off until the pool's name is typed exactly, then DELETE
 *       /api/pools/<id> runs in turn with the editor's changes. A refusal or no answer is said
 *       in the page, and nothing was deleted. When packs didn't answer, the pool is deleted
 *       anyway: the page says its pack's removal waits and links back to your pools, instead of
 *       going there at once.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Mon Sep 28, 2026
 */

"use client";

import { ButtonLink, TypeToConfirm } from "@haruhimemoe/ui";
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

/**
 * @function DeletePoolForm
 * @param props {DeletePoolFormProps} the pool's id and name, the editor, what to do after, and a
 *        fetcher (tests)
 * @returns {JSX.Element} the typed-name confirmation (ui's TypeToConfirm), or what happened to the
 *          pack
 */
export function DeletePoolForm({
  poolId,
  name,
  editor,
  onDeleted,
  fetcher = fetch,
}: DeletePoolFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [queued, setQueued] = useState<string | null>(null);
  const remove = async () => {
    setError(null);
    const answer = await editor.exclusive(() =>
      callPools<DeleteAnswer>(fetcher, `/api/pools/${poolId}`, { method: "DELETE" }),
    );
    if (answer.ok && answer.body?.packRemoval === "queued") {
      setQueued(answer.body.notice ?? "");
    } else if (answer.ok) {
      onDeleted();
    } else {
      setError(`${answer.message} The pool is still there.`);
    }
  };
  if (queued !== null) {
    return (
      <div className="flex flex-col gap-3">
        <p role="status" className="text-c2 text-sm">
          {`The pool is deleted. ${queued}`.trim()}
        </p>
        <ButtonLink href="/account#pools" variant="secondary" className="self-start">
          Back to your pools
        </ButtonLink>
      </div>
    );
  }
  return (
    <TypeToConfirm
      id="delete-pool"
      expected={name}
      submitLabel="Delete this pool"
      pendingLabel="Deleting…"
      error={error}
      onConfirm={remove}
    >
      <p className="text-c2 text-sm">
        This deletes the pool for you and everyone who edits it. It can't be undone.
      </p>
    </TypeToConfirm>
  );
}
