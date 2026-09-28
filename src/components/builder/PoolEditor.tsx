/**
 * @file src/components/builder/PoolEditor.tsx
 * @desc The pool editor at /pools/<id>/edit. Two panes on wide screens, stacked on phones: the
 *       pool (details, maps by bucket with values under each slot's mods and each slot's
 *       candidates, whose details and values are asked for as picks' are, the map browser right
 *       under them, where its range sliders have room, paste, targets, custom slots) and the side
 *       (summary with the content rules check, recent changes, export, editors, the pack on packs with "Update pack
 *       now", and the owner's settings: who can see it, handing it to an editor, and delete).
 *       Every change is saved at once through usePoolEditor; the saving bar stays in view, with
 *       Undo. A pool moderators hid says so. Editors see everything but the owner's settings, which go
 *       once the owner hands the pool over; the notice saying so is a live region that's always
 *       there, and takes focus from the settings that went.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Mon Sep 28, 2026
 */

"use client";

import { ButtonLink, Card, Notice, PageHeader } from "@haruhimemoe/ui";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { type CheckRules, ContentRulesCheck } from "@/components/builder/ContentRulesCheck";
import { CustomBucketForm } from "@/components/builder/CustomBucketForm";
import { DetailsForm } from "@/components/builder/DetailsForm";
import { EditorBrowser } from "@/components/builder/EditorBrowser";
import { EditorsPanel } from "@/components/builder/EditorsPanel";
import { ExportPanel } from "@/components/builder/ExportPanel";
import { OwnerSettings } from "@/components/builder/OwnerSettings";
import { PackPanel } from "@/components/builder/PackPanel";
import { PasteBox } from "@/components/builder/PasteBox";
import { PoolMaps } from "@/components/builder/PoolMaps";
import { PoolSummary } from "@/components/builder/PoolSummary";
import { RecentChanges } from "@/components/builder/RecentChanges";
import { SaveState } from "@/components/builder/SaveState";
import { TargetsForm } from "@/components/builder/TargetsForm";
import { UndoButton } from "@/components/builder/UndoButton";
import { HIDDEN_BY_MODERATION, VISIBILITY_TEXT } from "@/constants/built-pools";
import { usePoolEditor } from "@/hooks/usePoolEditor";
import { useSlotMaps } from "@/hooks/useSlotMaps";
import { useSlotValues } from "@/hooks/useSlotValues";
import type { Fetcher } from "@/lib/pool-client";
import type { BuiltMaps, ClientPool } from "@/schemas/built-pool-view";
import { candidateSlots } from "@/utils/candidate-view";
import type { SlotValueMap } from "@/utils/slot-values";

type PoolEditorProps = {
  initial: ClientPool;
  maps: BuiltMaps;
  /** Values under each slot's mods, as the page read them. */
  values: SlotValueMap;
  /** The page's read had every answer from the mirror (false: its math is asked for again). */
  valuesComplete?: boolean;
  /** The signed-in user's osu! id. */
  me: number;
  rules: CheckRules;
  fetcher?: Fetcher;
  pollMs?: number;
};

const YOUR_POOLS = "/account#pools";

/**
 * @function PoolEditor
 * @param props {PoolEditorProps} the pool, its maps and values, who's editing, the content rules
 *        and a fetcher (tests)
 * @returns {JSX.Element} the editor: maps, browser, details, targets, summary, check, activity and
 *          settings
 */
export function PoolEditor({
  initial,
  maps: known,
  values: knownValues,
  valuesComplete = true,
  me,
  rules,
  fetcher = fetch,
  pollMs,
}: PoolEditorProps) {
  const router = useRouter();
  const editor = usePoolEditor(initial, { fetcher, ...(pollMs ? { pollMs } : {}) });
  const { pool, change } = editor;
  const slots = [...pool.slots, ...candidateSlots(pool.candidates)];
  const maps = useSlotMaps(pool.id, slots, known, fetcher);
  const values = useSlotValues(
    { ...pool, slots },
    knownValues,
    valuesComplete,
    !editor.saving,
    fetcher,
  );
  const [openedFor, setOpenedFor] = useState<string | null>(null);
  const [openCount, setOpenCount] = useState(0);
  const [handedOver, setHandedOver] = useState<string | null>(null);
  const handedRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (handedOver) handedRef.current?.focus();
  }, [handedOver]);
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
        actions={<UndoButton steps={editor.undoSteps} onUndo={editor.undo} />}
      />
      {pool.hidden ? <Notice tone="warning">{HIDDEN_BY_MODERATION[pool.visibility]}</Notice> : null}
      {/* Always there, so the handover is announced; it takes focus from the card that goes. */}
      <Notice
        live
        ref={handedRef}
        tabIndex={-1}
        data-handover
        className={handedOver ? undefined : "sr-only"}
      >
        {handedOver}
      </Notice>
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
          {/* Under the maps, in the wide column: the side column is too narrow for its sliders. */}
          <EditorBrowser
            pool={pool}
            change={change}
            openedFor={openedFor}
            openCount={openCount}
            fetcher={fetcher}
          />
          <Card title="Paste a pool">
            <PasteBox change={change} lines={editor.failure?.lines} />
          </Card>
          <Card title="Targets">
            <TargetsForm pool={pool} change={change} />
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
          <Card title="Recent changes">
            <RecentChanges poolId={pool.id} version={pool.version} fetcher={fetcher} />
          </Card>
          <Card title="Export">
            <ExportPanel pool={pool} maps={maps} values={values} />
          </Card>
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
            <OwnerSettings
              pool={pool}
              editor={editor}
              fetcher={fetcher}
              onHandedOver={setHandedOver}
              onDeleted={() => router.push(YOUR_POOLS)}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
