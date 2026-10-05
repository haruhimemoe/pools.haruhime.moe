/**
 * @file src/components/builder/BucketRows.tsx
 * @desc A bucket's rows in the editor, by slot number: each pick (SlotRow) with its candidate list
 *       under it, and each slot with candidates and no pick (EmptySlotRow), in between where its
 *       number falls. The maps with no slot have no candidates. Presentational.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Oct 5, 2026
 */

"use client";

import { type PoolSlot, slotLabel } from "@haruhimemoe/pool";
import type { Sortable } from "@haruhimemoe/ui";
import { useState } from "react";
import { CandidateList } from "@/components/builder/CandidateList";
import { EmptySlotRow } from "@/components/builder/EmptySlotRow";
import { type MoveTarget, SlotRow } from "@/components/builder/SlotRow";
import type { Candidate } from "@/schemas/built-candidates";
import type { SlotNotes } from "@/schemas/built-plan";
import type { BuiltMaps } from "@/schemas/built-pool-view";
import type { CandidateContext } from "@/schemas/candidate-editor";
import { candidatesAt, emptyRows } from "@/utils/candidate-view";
import { type SlotValueMap, slotValueKey } from "@/utils/slot-values";

/** What a slot row can do: remove and note (moving goes through the sortable hook). */
export type SlotActions = {
  onRemove: (slot: PoolSlot) => void;
  onNote: (slot: PoolSlot, note: string) => void;
};

type BucketRowsProps = SlotActions & {
  code: string | null;
  slots: readonly PoolSlot[];
  /** The bucket's combo, for values' keys. */
  combo: (slot: PoolSlot) => string;
  maps: BuiltMaps;
  values: SlotValueMap;
  targets: readonly MoveTarget[];
  notes: SlotNotes;
  badgeOf: (slot: PoolSlot) => string | null;
  sortable: Sortable;
  candidates?: CandidateContext | undefined;
};

type Row = { index: number; pick: PoolSlot | null };

/**
 * @function BucketRows
 * @param props {BucketRowsProps} the bucket, its picks and candidates, and the actions
 * @returns {JSX.Element} the bucket's rows in slot order
 */
export function BucketRows(props: BucketRowsProps) {
  const { code, slots, combo, maps, values, targets, notes, badgeOf, sortable, candidates, ...on } =
    props;
  // Kept here, by slot number, so a list stays open when its slot's pick changes.
  const [opened, setOpened] = useState<ReadonlyMap<number, boolean>>(new Map());
  const empty = code === null || !candidates ? [] : emptyRows(candidates.candidates, slots, code);
  const rows: Row[] = [
    ...slots.map((pick) => ({ index: pick.index, pick })),
    ...empty.map((index) => ({ index, pick: null })),
  ].sort((a, b) => a.index - b.index);
  const listFor = (index: number, open: boolean) => {
    if (code === null || !candidates) return null;
    const place = { bucket: code, index };
    const list: Candidate[] = candidatesAt(candidates.candidates, place);
    if (list.length === 0) return null;
    return (
      <CandidateList
        place={place}
        label={slotLabel({ mod: code, index })}
        list={list}
        maps={maps}
        values={values}
        combo={combo({ mod: code, index, beatmapId: 0 })}
        members={candidates.members}
        me={candidates.me}
        open={opened.get(index) ?? open}
        onOpenChange={(next) => setOpened((was) => new Map(was).set(index, next))}
        sortable={sortable}
        onPromote={(entry) => candidates.onPromote(place, entry)}
        onRemove={(entry) => candidates.onRemove(place, entry)}
        onVote={(entry, vote) => candidates.onVote(place, entry, vote)}
        onNote={(entry, note) => candidates.onNote(place, entry, note)}
      />
    );
  };
  return (
    <ol className="flex flex-col">
      {rows.map(({ index, pick }, position) => {
        if (!pick) {
          const label = slotLabel({ mod: code, index });
          return (
            <EmptySlotRow
              key={`empty-${index}`}
              place={{ bucket: code ?? "", index }}
              label={label}
              position={position}
              sortable={sortable}
            >
              {listFor(index, true)}
            </EmptySlotRow>
          );
        }
        return (
          <SlotRow
            key={pick.beatmapId}
            slot={pick}
            map={maps[pick.beatmapId]}
            values={values[slotValueKey(pick.beatmapId, combo(pick))]}
            badge={badgeOf(pick)}
            note={notes[String(pick.beatmapId)]}
            position={position}
            sortable={sortable}
            onNote={(note) => on.onNote(pick, note)}
            targets={targets}
            onRemove={() => on.onRemove(pick)}
            onDemote={code !== null && candidates ? () => candidates.onDemote(pick) : undefined}
          >
            {listFor(index, false)}
          </SlotRow>
        );
      })}
    </ol>
  );
}
