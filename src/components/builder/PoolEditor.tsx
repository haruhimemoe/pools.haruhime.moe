/**
 * @file src/components/builder/PoolEditor.tsx
 * @desc The pool editor at /pools/<id>/edit. Two panes on wide screens, stacked on phones: the
 *       pool (details, maps by bucket with values under each slot's mods, paste, custom slots)
 *       and the side (summary with the content rules check, the map browser, editors, the pack
 *       on packs with "Update pack now", and the owner's settings: who can see it and delete). Every change is saved at once through usePoolEditor; the saving bar stays in
 *       view. A pool moderators hid says so. Editors see everything but the owner's settings.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

"use client";

import { ButtonLink, Card, Notice, PageHeader } from "@haruhimemoe/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { type CheckRules, ContentRulesCheck } from "@/components/builder/ContentRulesCheck";
import { CustomBucketForm } from "@/components/builder/CustomBucketForm";
import { DeletePoolForm } from "@/components/builder/DeletePoolForm";
import { DetailsForm } from "@/components/builder/DetailsForm";
import { EditorsPanel } from "@/components/builder/EditorsPanel";
import { MapBrowserPane } from "@/components/builder/MapBrowserPane";
import { PackPanel } from "@/components/builder/PackPanel";
import { PasteBox } from "@/components/builder/PasteBox";
import { PoolMaps } from "@/components/builder/PoolMaps";
import { PoolSummary } from "@/components/builder/PoolSummary";
import { SaveState } from "@/components/builder/SaveState";
import { VisibilityForm } from "@/components/builder/VisibilityForm";
import { VISIBILITY_TEXT } from "@/constants/built-pools";
import { HIDDEN_NOTICE, usePoolEditor } from "@/hooks/usePoolEditor";
import { useSlotMaps } from "@/hooks/useSlotMaps";
import { useSlotValues } from "@/hooks/useSlotValues";
import type { Fetcher } from "@/lib/pool-client";
import type { BuiltMaps, ClientPool } from "@/schemas/built-pool-view";
import type { SlotValueMap } from "@/utils/slot-values";

type PoolEditorProps = {
  initial: ClientPool;
  maps: BuiltMaps;
  /** Values under each slot's mods, as the page read them. */
  values: SlotValueMap;
  /** The signed-in user's osu! id. */
  me: number;
  rules: CheckRules;
  fetcher?: Fetcher;
  pollMs?: number;
};

const YOUR_POOLS = "/account#pools";

export function PoolEditor({
  initial,
  maps: known,
  values: knownValues,
  me,
  rules,
  fetcher = fetch,
  pollMs,
}: PoolEditorProps) {
  const router = useRouter();
  const editor = usePoolEditor(initial, { fetcher, ...(pollMs ? { pollMs } : {}) });
  const { pool, change } = editor;
  const maps = useSlotMaps(pool.id, pool.slots, known, fetcher);
  const values = useSlotValues(pool, knownValues, !editor.saving, fetcher);
  const [openedFor, setOpenedFor] = useState<string | null>(null);
  const [openCount, setOpenCount] = useState(0);
  const onFind = (code: string) => {
    setOpenedFor(code);
    setOpenCount((n) => n + 1);
  };
  const role = pool.access.isOwner ? "You own this pool." : "You edit this pool.";
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={pool.name}
        lead={role}
        meta={VISIBILITY_TEXT[pool.visibility].label}
        actions={
          <ButtonLink href={`/pools/${pool.id}`} variant="secondary">
            View the pool's page
          </ButtonLink>
        }
      />
      <SaveState
        saving={editor.saving}
        failure={editor.failure}
        conflict={editor.conflict}
        gone={editor.gone}
        onDismiss={editor.dismiss}
      />
      {pool.hidden ? <Notice tone="warning">{HIDDEN_NOTICE}</Notice> : null}
      <div
        data-panes
        className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]"
      >
        <div className="flex min-w-0 flex-col gap-6">
          <Card title="Details">
            <DetailsForm pool={pool} change={change} />
          </Card>
          <Card title="Maps">
            <PoolMaps pool={pool} maps={maps} values={values} change={change} onFind={onFind} />
          </Card>
          <Card title="Paste a pool">
            <PasteBox change={change} lines={editor.failure?.lines} />
          </Card>
          <Card title="Custom slots">
            <CustomBucketForm pool={pool} change={change} />
          </Card>
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          <Card title="Summary">
            <PoolSummary pool={pool} maps={maps} values={values} />
            <h3 className="mt-4 mb-2 font-bold text-c1">Check against the content rules</h3>
            <ContentRulesCheck slots={pool.slots} rules={rules} />
          </Card>
          <MapBrowserPane
            buckets={pool.buckets}
            poolIds={pool.slots.map((slot) => slot.beatmapId)}
            openedFor={openedFor}
            openCount={openCount}
            onAdd={(beatmapId, bucket) => change([{ type: "addMap", beatmapId, bucket }])}
            fetcher={fetcher}
          />
          <Card title="Editors">
            <EditorsPanel
              pool={pool}
              editor={editor}
              me={me}
              fetcher={fetcher}
              onLeft={() => router.push(YOUR_POOLS)}
            />
          </Card>
          <Card title="Pack on packs">
            <PackPanel pool={pool} editor={editor} fetcher={fetcher} />
          </Card>
          {pool.access.isOwner ? (
            <Card title="Owner settings">
              <div className="flex flex-col gap-6">
                <VisibilityForm pool={pool} editor={editor} fetcher={fetcher} />
                <h3 className="font-bold text-c1">Delete this pool</h3>
                <DeletePoolForm
                  poolId={pool.id}
                  name={pool.name}
                  editor={editor}
                  fetcher={fetcher}
                  onDeleted={() => router.push(YOUR_POOLS)}
                />
              </div>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
