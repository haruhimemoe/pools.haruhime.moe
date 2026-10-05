/**
 * @file src/components/builder/EmptySlotRow.tsx
 * @desc A slot in the editor with candidates and no pick: its label, a line saying so, and its
 *       candidate list (open). The row is a drop target: a candidate of the bucket dropped on it
 *       becomes the pick. It counts for nothing at the pool level (targets, summary, export,
 *       packs): only picks do. Presentational.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Oct 5, 2026
 */

"use client";

import { cx, ModBadge, SORTABLE_ITEM, type Sortable, Text } from "@haruhimemoe/ui";
import type { ReactNode } from "react";
import { bucketListId, emptySlotId } from "@/utils/sortable-ids";

type EmptySlotRowProps = {
  place: { bucket: string; index: number };
  /** Its label ("NM4"). */
  label: string;
  /** Its place in the bucket's list, for dragging (a drop target only, never lifted). */
  position: number;
  sortable: Sortable;
  /** Its candidate list. */
  children: ReactNode;
};

/**
 * @function EmptySlotRow
 * @param props {EmptySlotRowProps} the slot, its label, dragging and its candidate list
 * @returns {JSX.Element} the slot as a list item, as a drop target
 */
export function EmptySlotRow({ place, label, position, sortable, children }: EmptySlotRowProps) {
  const id = emptySlotId(place);
  return (
    <li
      data-empty-slot={label}
      {...sortable.item(id, {
        container: bucketListId(place.bucket),
        index: position,
        label,
        draggable: false,
      })}
      className={cx("flex flex-col gap-2 border-b3 border-t py-3", SORTABLE_ITEM)}
    >
      <div className="flex items-center gap-3">
        <span className="coarse:w-11 w-6 shrink-0" />
        <span className="w-14 shrink-0">
          <ModBadge mod={label} />
        </span>
        <Text tone="muted">No pick yet. Promote a candidate or drop one here.</Text>
      </div>
      {children}
    </li>
  );
}
