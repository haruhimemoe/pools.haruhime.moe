/**
 * @file src/components/builder/TransferOwnerForm.tsx
 * @desc The owner's "Hand this pool to an editor". Editors who have signed in can be picked;
 *       the rest are listed, off, with "hasn't signed in yet". The confirmation is in the page
 *       (no confirm() dialog): the button stays off until an editor is picked and the pool's
 *       name is typed exactly, then POST /api/pools/<id>/owner runs in turn with the editor's
 *       changes. The answer is the pool as the old owner now sees it, so the owner's settings
 *       go and onDone says who owns it. A refusal is said in the page.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

"use client";

import { Button, TextInput } from "@haruhimemoe/ui";
import { type FormEvent, useState } from "react";
import type { PoolEditor } from "@/hooks/usePoolEditor";
import { callPools, type Fetcher } from "@/lib/pool-client";
import type { ClientPool } from "@/schemas/built-pool-view";

export const NO_HANDOVER =
  "Only an editor who has signed in to pools can take the pool over. Add one above first.";

type TransferOwnerFormProps = {
  pool: ClientPool;
  editor: Pick<PoolEditor, "exclusive" | "adopt">;
  /** After the handover, with what to tell the old owner. */
  onDone: (message: string) => void;
  fetcher?: Fetcher;
};

export function TransferOwnerForm(props: TransferOwnerFormProps) {
  const { pool, editor, onDone, fetcher = fetch } = props;
  const [picked, setPicked] = useState<number | null>(null);
  const [typed, setTyped] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const target = pool.editors.find((person) => person.osuId === picked && person.signedIn);
  const ready = target !== undefined && typed.trim() === pool.name;
  if (!pool.editors.some((person) => person.signedIn)) {
    return <p className="text-c3 text-sm">{NO_HANDOVER}</p>;
  }
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!ready) return;
    setPending(true);
    setError(null);
    const answer = await editor.exclusive(() =>
      callPools<{ pool: ClientPool }>(fetcher, `/api/pools/${pool.id}/owner`, {
        method: "POST",
        body: { osuId: target.osuId, confirmName: typed.trim() },
      }),
    );
    setPending(false);
    if (!answer.ok) {
      setError(`${answer.message} You still own the pool.`);
      return;
    }
    onDone(`${target.username} owns this pool now. You still edit it.`);
    editor.adopt(answer.body.pool);
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-3 text-sm">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-bold text-c3">New owner</legend>
        {pool.editors.map((person) => (
          <label key={person.osuId} className="flex items-center gap-2">
            <input
              type="radio"
              name="new-owner"
              value={person.osuId}
              disabled={!person.signedIn}
              checked={picked === person.osuId}
              onChange={() => setPicked(person.osuId)}
              className="accent-h1"
            />
            <span className="font-bold text-c1">{person.username}</span>
            {person.signedIn ? null : <span className="text-c3">hasn't signed in yet</span>}
          </label>
        ))}
      </fieldset>
      <p className="text-c2">
        They get every owner setting, and you stay on as an editor. Only they can give it back.
      </p>
      <TextInput
        id="transfer-pool"
        label={`Type ${pool.name} to hand it over`}
        value={typed}
        autoComplete="off"
        spellCheck={false}
        onChange={(event) => setTyped(event.target.value)}
      />
      <Button type="submit" variant="secondary" className="self-start" disabled={!ready || pending}>
        {pending ? "Handing over…" : "Hand the pool over"}
      </Button>
      {error ? (
        <p role="alert" className="font-bold text-rose-300">
          {error}
        </p>
      ) : null}
    </form>
  );
}
