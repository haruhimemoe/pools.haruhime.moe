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
 * @modified Sun Sep 27, 2026
 */

"use client";

import { Button, ButtonLink, TextInput } from "@haruhimemoe/ui";
import { type FormEvent, useState } from "react";
import type { PoolEditor } from "@/hooks/usePoolEditor";
import { callPools, type Fetcher } from "@/lib/pool-client";

type DeleteAnswer = { packRemoval?: "queued"; notice?: string } | null;

type DeletePoolFormProps = {
  poolId: string;
  name: string;
  editor: Pick<PoolEditor, "exclusive">;
  onDeleted: () => void;
  fetcher?: Fetcher;
};

export function DeletePoolForm({
  poolId,
  name,
  editor,
  onDeleted,
  fetcher = fetch,
}: DeletePoolFormProps) {
  const [typed, setTyped] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [queued, setQueued] = useState<string | null>(null);
  const matches = typed.trim() === name;
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!matches) return;
    setPending(true);
    setError(null);
    const answer = await editor.exclusive(() =>
      callPools<DeleteAnswer>(fetcher, `/api/pools/${poolId}`, { method: "DELETE" }),
    );
    if (answer.ok && answer.body?.packRemoval === "queued") {
      setQueued(answer.body.notice ?? "");
      return;
    }
    if (answer.ok) {
      onDeleted();
      return;
    }
    setError(`${answer.message} The pool is still there.`);
    setPending(false);
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
    <form onSubmit={submit} className="flex flex-col gap-3">
      <p className="text-c2 text-sm">
        This deletes the pool for you and everyone who edits it. It can't be undone.
      </p>
      <TextInput
        id="delete-pool"
        label={`Type ${name} to confirm`}
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
        {pending ? "Deleting…" : "Delete this pool"}
      </Button>
      {error ? (
        <p role="alert" className="font-bold text-rose-300 text-sm">
          {error}
        </p>
      ) : null}
    </form>
  );
}
