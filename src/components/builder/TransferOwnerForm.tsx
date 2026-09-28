/**
 * @file src/components/builder/TransferOwnerForm.tsx
 * @desc The owner's "Hand this pool to an editor". Editors who have signed in can be picked;
 *       the rest are listed, off, with "hasn't signed in yet". The confirmation is in the page
 *       (no confirm() dialog; ui's RadioGroup and TypeToConfirm): the button stays off until an
 *       editor is picked and the pool's name is typed exactly, then POST /api/pools/<id>/owner runs in turn with the editor's
 *       changes. The answer is the pool as the old owner now sees it, so the owner's settings
 *       go and onDone says who owns it. A refusal is said in the page.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Mon Sep 28, 2026
 */

"use client";

import { RadioGroup, TypeToConfirm } from "@haruhimemoe/ui";
import { useState } from "react";
import { callPools, type Fetcher } from "@/lib/pool-client";
import type { ClientPool } from "@/schemas/built-pool-view";
import type { PoolEditor } from "@/schemas/pool-editor";

export const NO_HANDOVER =
  "Only an editor who has signed in to pools can take the pool over. Add one above first.";

/** No one types a NUL, so this never matches. */
const UNMATCHABLE = "\u0000";

type TransferOwnerFormProps = {
  pool: ClientPool;
  editor: Pick<PoolEditor, "exclusive" | "adopt">;
  /** After the handover, with what to tell the old owner. */
  onDone: (message: string) => void;
  fetcher?: Fetcher;
};

/**
 * @function TransferOwnerForm
 * @param props {TransferOwnerFormProps} the pool, the editor's exclusive and adopt, what to do
 *        after, and a fetcher (tests)
 * @returns {JSX.Element} the editors to pick from and the typed-name confirmation, or why no one
 *          can take the pool over yet
 */
export function TransferOwnerForm(props: TransferOwnerFormProps) {
  const { pool, editor, onDone, fetcher = fetch } = props;
  const [picked, setPicked] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const target = pool.editors.find((person) => person.osuId === picked && person.signedIn);
  if (!pool.editors.some((person) => person.signedIn)) {
    return <p className="text-c3 text-sm">{NO_HANDOVER}</p>;
  }
  const pick = (value: string) => setPicked(Number(value));
  const handOver = async () => {
    if (!target) return;
    setError(null);
    const answer = await editor.exclusive(() =>
      callPools<{ pool: ClientPool }>(fetcher, `/api/pools/${pool.id}/owner`, {
        method: "POST",
        body: { osuId: target.osuId, confirmName: pool.name },
      }),
    );
    if (!answer.ok) {
      setError(`${answer.message} You still own the pool.`);
      return;
    }
    onDone(`${target.username} owns this pool now. You still edit it.`);
    editor.adopt(answer.body.pool);
  };
  return (
    <div className="flex flex-col gap-3 text-sm">
      <RadioGroup
        label="New owner"
        name="new-owner"
        value={picked === null ? "" : String(picked)}
        onChange={pick}
        options={pool.editors.map((person) => ({
          value: String(person.osuId),
          label: person.username,
          hint: person.signedIn ? undefined : "hasn't signed in yet",
          disabled: !person.signedIn,
        }))}
      />
      <TypeToConfirm
        id="transfer-pool"
        // Until an editor is picked nothing typed can match, so the button stays off.
        expected={target ? pool.name : UNMATCHABLE}
        label={`Type ${pool.name} to hand it over`}
        submitLabel="Hand the pool over"
        pendingLabel="Handing over…"
        error={error}
        onConfirm={handOver}
      >
        <p className="text-c2">
          They get every owner setting, and you stay on as an editor. Only they can give it back.
        </p>
      </TypeToConfirm>
    </div>
  );
}
