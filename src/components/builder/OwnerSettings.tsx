/**
 * @file src/components/builder/OwnerSettings.tsx
 * @desc The owner's settings in the editor: who can see the pool, who can see its history,
 *       handing the pool to an editor (the answer takes these settings away), and deleting it.
 *       Only the owner gets this card.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Oct 5, 2026
 */

"use client";

import { Card } from "@haruhimemoe/ui";
import { DeletePoolForm } from "@/components/builder/DeletePoolForm";
import { TransferOwnerForm } from "@/components/builder/TransferOwnerForm";
import { VisibilityForm } from "@/components/builder/VisibilityForm";
import { HistoryVisibilityForm } from "@/components/history/HistoryVisibilityForm";
import type { Fetcher } from "@/lib/pool-client";
import type { ClientPool } from "@/schemas/built-pool-view";
import type { PoolEditor } from "@/schemas/pool-editor";

type OwnerSettingsProps = {
  pool: ClientPool;
  editor: PoolEditor;
  fetcher: Fetcher;
  /** The pool went to an editor: what to say. */
  onHandedOver: (message: string) => void;
  onDeleted: () => void;
};

/**
 * @function OwnerSettings
 * @param props {OwnerSettingsProps} the pool, the editor, a fetcher (tests) and what to do after a
 *        handover or delete
 * @returns {JSX.Element} the owner's visibility, editors, handover and delete
 */
export function OwnerSettings({ pool, editor, fetcher, ...on }: OwnerSettingsProps) {
  return (
    <Card title="Owner settings">
      <div className="flex flex-col gap-6">
        <VisibilityForm pool={pool} editor={editor} fetcher={fetcher} />
        <HistoryVisibilityForm
          poolId={pool.id}
          historyPublic={pool.historyPublic === true}
          fetcher={fetcher}
        />
        <h3 className="font-bold text-c1">Hand this pool to an editor</h3>
        <TransferOwnerForm pool={pool} editor={editor} fetcher={fetcher} onDone={on.onHandedOver} />
        <h3 className="font-bold text-c1">Delete this pool</h3>
        <DeletePoolForm
          poolId={pool.id}
          name={pool.name}
          editor={editor}
          fetcher={fetcher}
          onDeleted={on.onDeleted}
        />
      </div>
    </Card>
  );
}
