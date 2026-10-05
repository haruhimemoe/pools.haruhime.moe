/**
 * @file src/components/builder/TransferOwnerForm.tsx
 * @desc The owner's "Hand this pool to an editor". Editors who have signed in can be picked;
 *       the rest are listed, off, with "hasn't signed in yet". The confirmation is a dialog
 *       (ui's ConfirmDialog): its button stays off until an editor is picked, and in the dialog
 *       the pool's name is typed before POST /api/pools/<id>/owner runs in turn with the
 *       editor's changes. The answer is the pool as the old owner now sees it, so the owner's
 *       settings go and onDone says who owns it. A refusal is said in the dialog.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Mon Oct 5, 2026
 */

"use client";

import { ConfirmDialog, RadioGroup, Text } from "@haruhimemoe/ui";
import { useState } from "react";
import { NO_HANDOVER } from "@/constants/built-pools";
import { callPools, type Fetcher } from "@/lib/pool-client";
import type { ClientPool } from "@/schemas/built-pool-view";
import type { PoolEditor } from "@/schemas/pool-editor";

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
  const target = pool.editors.find((person) => person.osuId === picked && person.signedIn);
  if (!pool.editors.some((person) => person.signedIn)) {
    return <Text tone="muted">{NO_HANDOVER}</Text>;
  }
  const pick = (value: string) => setPicked(Number(value));
  const handOver = async () => {
    if (!target) return;
    const answer = await editor.exclusive(() =>
      callPools<{ pool: ClientPool }>(fetcher, `/api/pools/${pool.id}/owner`, {
        method: "POST",
        body: { osuId: target.osuId, confirmName: pool.name },
      }),
    );
    if (!answer.ok) throw new Error(`${answer.message} You still own the pool.`);
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
      <ConfirmDialog
        trigger="Hand the pool over"
        triggerProps={{ disabled: !target }}
        title={`Hand this pool to ${target?.username ?? "an editor"}?`}
        description="They get every owner setting, and you stay on as an editor. Only they can give it back."
        typeToConfirm={{ expected: pool.name, label: `Type ${pool.name} to hand it over` }}
        confirmLabel="Hand it over"
        pendingLabel="Handing over…"
        failedMessage={(error) => (error as Error).message}
        returnFocus={() => document.querySelector<HTMLElement>("[data-handover]")}
        onConfirm={handOver}
      />
    </div>
  );
}
