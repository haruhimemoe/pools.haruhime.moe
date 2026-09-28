/**
 * @file src/components/builder/OwnerSettings.tsx
 * @desc The owner's settings in the editor: who can see the pool, handing it to an editor (the
 *       answer takes these settings away), and deleting it. Only the owner gets this card.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

"use client";

import { Card } from "@haruhimemoe/ui";
import { DeletePoolForm } from "@/components/builder/DeletePoolForm";
import { TransferOwnerForm } from "@/components/builder/TransferOwnerForm";
import { VisibilityForm } from "@/components/builder/VisibilityForm";
import type { PoolEditor } from "@/hooks/usePoolEditor";
import type { Fetcher } from "@/lib/pool-client";
import type { ClientPool } from "@/schemas/built-pool-view";

type OwnerSettingsProps = {
  pool: ClientPool;
  editor: PoolEditor;
  fetcher: Fetcher;
  /** The pool went to an editor: what to say. */
  onHandedOver: (message: string) => void;
  onDeleted: () => void;
};

export function OwnerSettings({ pool, editor, fetcher, ...on }: OwnerSettingsProps) {
  return (
    <Card title="Owner settings">
      <div className="flex flex-col gap-6">
        <VisibilityForm pool={pool} editor={editor} fetcher={fetcher} />
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
